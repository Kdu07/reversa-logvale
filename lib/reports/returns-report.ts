/**
 * Montagem do relatório mensal de devoluções (XLSX).
 *
 * Puro de propósito: recebe as linhas já normalizadas e devolve o arquivo em
 * base64. Nada aqui toca Supabase, o que torna abas, KPIs e consolidação
 * testáveis sem banco.
 */

import * as XLSX from 'xlsx'
import { DECISION_LABELS } from '@/lib/decisions'
import { DECIDED_BY_LABELS, IDENTIFIER_TYPE_LABELS, formatDate, identifierLabel } from '@/lib/format'
import { ptBR } from '@/lib/i18n/pt-BR'
import type { ReportPeriod } from '@/lib/reports/period'
import type { DecisionSource, IdentifierType, ReturnDecision, ReturnStatus } from '@/types'

const DECISIONS: ReturnDecision[] = ['return_to_stock', 'store_for_handling', 'discard', 'repackage']
const STATUSES:  ReturnStatus[]   = ['awaiting_decision', 'decided', 'processed']

export interface ReportReturnRow {
  rv:                string
  identifierType:    IdentifierType
  accessKey:         string | null
  postalCode:        string | null
  logisticsCode:     string | null
  illegibleToken:    string | null
  depositorId:       string | null
  depositorName:     string | null
  depositorCnpj:     string | null
  finalCustomerName: string | null
  itemCount:         number
  operatorName:      string | null
  status:            ReturnStatus
  decision:          ReturnDecision | null
  decidedByType:     DecisionSource | null
  receivedAt:        string
  decidedAt:         string | null
  processedAt:       string | null
  hasInvoice:        boolean
}

export interface ReportMeta {
  period:         ReportPeriod
  /** Razão social quando o relatório é de um depositante; `null` = todos. */
  depositorName:  string | null
  /** Rótulo do recorte de status ("Todos", "Aguardando Decisão", …). */
  statusLabel:    string
  generatedAt:    string
  generatedBy:    string
}

export interface ReportSummary {
  total:            number
  itemTotal:        number
  byStatus:         Record<ReturnStatus, number>
  byDecision:       Record<ReturnDecision, number>
  autoCount:        number
  autoRate:         number | null
  avgDecisionHours: number | null
  avgProcessHours:  number | null
  missingInvoice:   number
}

export interface DepositorSummaryRow extends ReportSummary {
  depositorName: string
  depositorCnpj: string | null
}

const hoursBetween = (from: string, to: string) =>
  (new Date(to).getTime() - new Date(from).getTime()) / 3_600_000

const round1 = (n: number) => Math.round(n * 10) / 10

function average(values: number[]): number | null {
  if (values.length === 0) return null
  return round1(values.reduce((sum, v) => sum + v, 0) / values.length)
}

const emptyBy = <T extends string>(keys: T[]) =>
  Object.fromEntries(keys.map((k) => [k, 0])) as Record<T, number>

/** KPIs de um conjunto de devoluções — mesmas definições do dashboard. */
export function summarize(rows: ReportReturnRow[]): ReportSummary {
  const byStatus   = emptyBy(STATUSES)
  const byDecision = emptyBy(DECISIONS)

  let itemTotal      = 0
  let decidedTotal   = 0
  let autoCount      = 0
  let missingInvoice = 0
  const decisionHours: number[] = []
  const processHours:  number[] = []

  for (const row of rows) {
    byStatus[row.status]++
    if (row.decision) byDecision[row.decision]++
    itemTotal += row.itemCount
    if (!row.hasInvoice) missingInvoice++

    if (row.decidedAt) {
      decidedTotal++
      if (row.decidedByType === 'auto') autoCount++
      decisionHours.push(hoursBetween(row.receivedAt, row.decidedAt))
      if (row.processedAt) processHours.push(hoursBetween(row.decidedAt, row.processedAt))
    }
  }

  return {
    total:            rows.length,
    itemTotal,
    byStatus,
    byDecision,
    autoCount,
    autoRate:         decidedTotal > 0 ? round1((autoCount / decidedTotal) * 100) : null,
    avgDecisionHours: average(decisionHours),
    avgProcessHours:  average(processHours),
    missingInvoice,
  }
}

/** Consolidado por depositante, ordenado por volume (desc) e razão social. */
export function summarizeByDepositor(rows: ReportReturnRow[]): DepositorSummaryRow[] {
  const groups = new Map<string, ReportReturnRow[]>()
  for (const row of rows) {
    const key = row.depositorId ?? '__sem_depositante__'
    const bucket = groups.get(key)
    if (bucket) bucket.push(row)
    else groups.set(key, [row])
  }

  return Array.from(groups.values())
    .map((group) => ({
      depositorName: group[0].depositorName ?? 'Sem depositante',
      depositorCnpj: group[0].depositorCnpj,
      ...summarize(group),
    }))
    .sort((a, b) => b.total - a.total || a.depositorName.localeCompare(b.depositorName, 'pt-BR'))
}

const dash = (value: string | null | undefined) => value ?? '—'
const hours = (value: number | null) => (value === null ? '—' : `${value.toString().replace('.', ',')} h`)

function summarySheet(rows: ReportReturnRow[], meta: ReportMeta): XLSX.WorkSheet {
  const s = summarize(rows)

  const aoa: (string | number)[][] = [
    ['Relatório de Devoluções'],
    [],
    ['Período',     meta.period.label],
    ['Critério',    'Data de recebimento'],
    ['Depositante', meta.depositorName ?? 'Todos'],
    ['Status',      meta.statusLabel],
    ['Gerado em',   `${formatDate(meta.generatedAt)} por ${meta.generatedBy}`],
    [],
    ['Total de devoluções', s.total],
    ['Total de itens',      s.itemTotal],
    [],
    ['Por status'],
    ...STATUSES.map((status) => [ptBR.returnStatus[status], s.byStatus[status]]),
    [],
    ['Por decisão'],
    ...DECISIONS.map((decision) => [DECISION_LABELS[decision], s.byDecision[decision]]),
    [],
    ['Indicadores'],
    ['Decisões automáticas (72h)', s.autoCount],
    ['Taxa de auto-decisão',       s.autoRate === null ? '—' : `${s.autoRate.toString().replace('.', ',')}%`],
    ['Tempo médio até decisão',    hours(s.avgDecisionHours)],
    ['Tempo médio até tratativa',  hours(s.avgProcessHours)],
    ['Sem NF anexada',             s.missingInvoice],
  ]

  const ws = XLSX.utils.aoa_to_sheet(aoa)
  ws['!cols'] = [{ wch: 30 }, { wch: 42 }]
  return ws
}

function detailSheet(rows: ReportReturnRow[]): XLSX.WorkSheet {
  const json = rows.map((row) => ({
    'Data Recebimento':   formatDate(row.receivedAt),
    'RV':                 row.rv,
    'Tipo Identificador': IDENTIFIER_TYPE_LABELS[row.identifierType] ?? row.identifierType,
    'Identificador':      identifierLabel(row),
    'Depositante':        dash(row.depositorName),
    'Cliente Final':      dash(row.finalCustomerName),
    'Nº Itens':           row.itemCount,
    'Operador':           dash(row.operatorName),
    'Status':             ptBR.returnStatus[row.status] ?? row.status,
    'Decisão':            row.decision ? DECISION_LABELS[row.decision] : '—',
    'Decidido por':       row.decidedByType ? DECIDED_BY_LABELS[row.decidedByType] : '—',
    'Data Decisão':       row.decidedAt   ? formatDate(row.decidedAt)   : '—',
    'Data Tratativa':     row.processedAt ? formatDate(row.processedAt) : '—',
    'NF Original':        row.hasInvoice ? 'Sim' : 'Não',
  }))

  const ws = XLSX.utils.json_to_sheet(json)
  ws['!cols'] = [
    { wch: 18 }, { wch: 14 }, { wch: 24 }, { wch: 52 }, { wch: 30 }, { wch: 30 },
    { wch: 9 },  { wch: 24 }, { wch: 18 }, { wch: 24 }, { wch: 14 }, { wch: 18 },
    { wch: 18 }, { wch: 12 },
  ]
  return ws
}

function byDepositorSheet(rows: ReportReturnRow[]): XLSX.WorkSheet {
  const json = summarizeByDepositor(rows).map((d) => ({
    'Depositante':   d.depositorName,
    'CNPJ':          dash(d.depositorCnpj),
    'Devoluções':    d.total,
    'Itens':         d.itemTotal,
    'Aguardando':    d.byStatus.awaiting_decision,
    'Decididas':     d.byStatus.decided,
    'Tratadas':      d.byStatus.processed,
    'Estoque':       d.byDecision.return_to_stock,
    'Tratativa':     d.byDecision.store_for_handling,
    'Retirada':      d.byDecision.discard,
    'Reembalagem':   d.byDecision.repackage,
    '% Automáticas': d.autoRate === null ? '—' : `${d.autoRate.toString().replace('.', ',')}%`,
  }))

  const ws = XLSX.utils.json_to_sheet(json)
  ws['!cols'] = [
    { wch: 34 }, { wch: 20 }, { wch: 12 }, { wch: 10 }, { wch: 12 }, { wch: 12 },
    { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 13 }, { wch: 14 },
  ]
  return ws
}

/** Acentos separados pelo NFD (U+0300–U+036F), descartados no slug. */
const COMBINING_MARKS = new RegExp('[\\u0300-\\u036f]', 'g')

/** Slug seguro para nome de arquivo a partir da razão social. */
export function reportSlug(name: string | null): string {
  if (!name) return 'todos'
  const slug = name
    .normalize('NFD')
    .replace(COMBINING_MARKS, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
  return slug || 'depositante'
}

export function reportFilename(meta: ReportMeta): string {
  return `relatorio-devolucoes-${reportSlug(meta.depositorName)}-${meta.period.slug}.xlsx`
}

/**
 * Gera o workbook. A aba "Por depositante" só entra no relatório completo —
 * num relatório de um único depositante ela repetiria o Resumo.
 */
export function buildReturnsReport(
  rows: ReportReturnRow[],
  meta: ReportMeta,
): { base64: string; filename: string } {
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, summarySheet(rows, meta), 'Resumo')
  XLSX.utils.book_append_sheet(wb, detailSheet(rows), 'Devoluções')
  if (meta.depositorName === null) {
    XLSX.utils.book_append_sheet(wb, byDepositorSheet(rows), 'Por depositante')
  }

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer

  return { base64: Buffer.from(buf).toString('base64'), filename: reportFilename(meta) }
}
