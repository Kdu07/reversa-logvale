'use server'

import { createClient } from '@/lib/supabase/server'
import { assertManager } from '@/lib/supabase/assert-role'
import { getCurrentUser } from '@/lib/supabase/get-current-user'
import { resolvePeriod, type PeriodInput } from '@/lib/reports/period'
import { buildReturnsReport, type ReportReturnRow } from '@/lib/reports/returns-report'
import { ptBR } from '@/lib/i18n/pt-BR'
import type { DecisionSource, IdentifierType, ReturnDecision, ReturnStatus } from '@/types'

/** Lote do fetch. O PostgREST corta em 1000 por resposta — paginamos até acabar. */
const BATCH_SIZE = 1000

/** Teto de linhas por relatório: o arquivo volta em base64 na resposta da action. */
const MAX_ROWS = 20_000

export interface ReportDepositorOption {
  id:   string
  name: string
}

export interface ReportFilters {
  period:       PeriodInput
  depositorId?: string
  status?:      ReturnStatus
}

export type GenerateReportResult =
  | { base64: string; filename: string; rowCount: number }
  | { empty: true; message: string }
  | { error: string }

export async function getReportDepositorsAction(): Promise<
  { rows: ReportDepositorOption[] } | { error: string }
> {
  try {
    await assertManager()
    const supabase = createClient()

    const { data, error } = await supabase
      .from('depositors')
      .select('id, razao_social')
      .eq('active', true)
      .order('razao_social')
    if (error) throw new Error(error.message)

    return { rows: (data ?? []).map((d) => ({ id: d.id, name: d.razao_social })) }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Erro interno' }
  }
}

type RawReturn = {
  rv:                  string
  identifier_type:     string
  access_key:          string | null
  postal_code:         string | null
  logistics_code:      string | null
  illegible_token:     string | null
  item_count:          number
  status:              string
  decision:            string | null
  decided_by_type:     string | null
  received_at:         string
  decided_at:          string | null
  processed_at:        string | null
  final_customer_name: string | null
  invoice_xml_url:     string | null
  invoice_pdf_url:     string | null
  depositor_id:        string | null
  depositors:          { razao_social: string; cnpj: string } | null
  profiles:            { full_name: string } | null
}

const SELECT_COLUMNS = `rv, identifier_type, access_key, postal_code, logistics_code, illegible_token,
   item_count, status, decision, decided_by_type, received_at, decided_at, processed_at,
   final_customer_name, invoice_xml_url, invoice_pdf_url, depositor_id,
   depositors!depositor_id(razao_social, cnpj),
   profiles!received_by(full_name)`

export async function generateReturnsReportAction(
  filters: ReportFilters,
): Promise<GenerateReportResult> {
  try {
    const user = await getCurrentUser()
    if (user.profile.role !== 'manager') return { error: 'Acesso negado' }

    const period   = resolvePeriod(filters.period)
    const supabase = createClient()

    // Nome do depositante para o cabeçalho e o nome do arquivo
    let depositorName: string | null = null
    if (filters.depositorId) {
      const { data, error } = await supabase
        .from('depositors')
        .select('razao_social')
        .eq('id', filters.depositorId)
        .single()
      if (error) throw new Error(error.message)
      depositorName = data.razao_social
    }

    const rows: ReportReturnRow[] = []

    // Paginação explícita: sem ela o relatório seria truncado em 1000 linhas
    // silenciosamente, sem erro nenhum.
    for (let offset = 0; ; offset += BATCH_SIZE) {
      let query = supabase
        .from('returns')
        .select(SELECT_COLUMNS)
        .gte('received_at', period.from)
        .lt('received_at', period.to)
        .order('received_at', { ascending: true })
        .range(offset, offset + BATCH_SIZE - 1)

      if (filters.depositorId) query = query.eq('depositor_id', filters.depositorId)
      if (filters.status)      query = query.eq('status', filters.status)

      const { data, error } = await query
      // PostgrestError não é `Error`: sem isto a mensagem viraria "Erro interno"
      if (error) throw new Error(error.message)

      const batch = (data ?? []) as unknown as RawReturn[]
      rows.push(...batch.map(toReportRow))

      if (batch.length < BATCH_SIZE) break
      if (rows.length >= MAX_ROWS) {
        return {
          error: `O período selecionado tem mais de ${MAX_ROWS.toLocaleString('pt-BR')} devoluções. Gere o relatório por depositante ou reduza o intervalo.`,
        }
      }
    }

    if (rows.length === 0) {
      return {
        empty: true,
        message: `Nenhuma devolução recebida no período (${period.label})${
          depositorName ? ` para ${depositorName}` : ''
        }.`,
      }
    }

    const { base64, filename } = buildReturnsReport(rows, {
      period,
      depositorName,
      statusLabel: filters.status ? ptBR.returnStatus[filters.status] : 'Todos',
      generatedAt: new Date().toISOString(),
      generatedBy: user.profile.full_name,
    })

    return { base64, filename, rowCount: rows.length }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Erro interno' }
  }
}

function toReportRow(r: RawReturn): ReportReturnRow {
  return {
    rv:                r.rv,
    identifierType:    r.identifier_type as IdentifierType,
    accessKey:         r.access_key,
    postalCode:        r.postal_code,
    logisticsCode:     r.logistics_code,
    illegibleToken:    r.illegible_token,
    depositorId:       r.depositor_id,
    depositorName:     r.depositors?.razao_social ?? null,
    depositorCnpj:     r.depositors?.cnpj ?? null,
    finalCustomerName: r.final_customer_name,
    itemCount:         r.item_count,
    operatorName:      r.profiles?.full_name ?? null,
    status:            r.status as ReturnStatus,
    decision:          r.decision as ReturnDecision | null,
    decidedByType:     r.decided_by_type as DecisionSource | null,
    receivedAt:        r.received_at,
    decidedAt:         r.decided_at,
    processedAt:       r.processed_at,
    hasInvoice:        Boolean(r.invoice_xml_url || r.invoice_pdf_url),
  }
}
