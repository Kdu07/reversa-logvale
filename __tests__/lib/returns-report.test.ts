import { describe, it, expect } from 'vitest'
import * as XLSX from 'xlsx'
import { monthPeriod } from '@/lib/reports/period'
import {
  buildReturnsReport,
  reportFilename,
  reportSlug,
  summarize,
  summarizeByDepositor,
  type ReportMeta,
  type ReportReturnRow,
} from '@/lib/reports/returns-report'

function row(overrides: Partial<ReportReturnRow> = {}): ReportReturnRow {
  return {
    rv:                'RV-1',
    identifierType:    'access_key',
    accessKey:         '4'.repeat(44),
    postalCode:        null,
    logisticsCode:     null,
    illegibleToken:    null,
    depositorId:       'dep-1',
    depositorName:     'Acme Ltda',
    depositorCnpj:     '12345678000199',
    finalCustomerName: 'Cliente Final',
    itemCount:         2,
    operatorName:      'Operador Um',
    status:            'processed',
    decision:          'return_to_stock',
    decidedByType:     'client',
    receivedAt:        '2026-07-01T12:00:00-03:00',
    decidedAt:         '2026-07-02T12:00:00-03:00',  // +24h
    processedAt:       '2026-07-03T00:00:00-03:00',  // +12h da decisão
    hasInvoice:        true,
    ...overrides,
  }
}

const META: ReportMeta = {
  period:        monthPeriod(2026, 7),
  depositorName: null,
  statusLabel:   'Todos',
  generatedAt:   '2026-08-04T10:00:00-03:00',
  generatedBy:   'Gerente Teste',
}

function sheetsOf(base64: string) {
  const wb = XLSX.read(Buffer.from(base64, 'base64'), { type: 'buffer' })
  return {
    names: wb.SheetNames,
    rowsOf: (name: string) =>
      XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[name]),
    cellsOf: (name: string) =>
      XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[name], { header: 1 }),
  }
}

describe('summarize', () => {
  it('agrega totais, status, decisões e itens', () => {
    const s = summarize([
      row(),
      row({ status: 'decided', decision: 'discard', processedAt: null, itemCount: 3 }),
      row({ status: 'awaiting_decision', decision: null, decidedAt: null, decidedByType: null, processedAt: null, itemCount: 1 }),
    ])

    expect(s.total).toBe(3)
    expect(s.itemTotal).toBe(6)
    expect(s.byStatus).toEqual({ awaiting_decision: 1, decided: 1, processed: 1 })
    expect(s.byDecision.return_to_stock).toBe(1)
    expect(s.byDecision.discard).toBe(1)
    expect(s.byDecision.repackage).toBe(0)
  })

  it('médias usam só as devoluções com as datas correspondentes', () => {
    const s = summarize([
      row(),                                                        // 24h / 12h
      row({ decidedAt: '2026-07-01T18:00:00-03:00', processedAt: null }), // 6h, sem tratativa
      row({ decidedAt: null, decidedByType: null, processedAt: null }),   // fora das médias
    ])

    expect(s.avgDecisionHours).toBe(15)  // (24 + 6) / 2
    expect(s.avgProcessHours).toBe(12)   // só a primeira
  })

  it('taxa de auto-decisão considera apenas devoluções decididas', () => {
    const s = summarize([
      row({ decidedByType: 'auto' }),
      row({ decidedByType: 'client' }),
      row({ decidedAt: null, decidedByType: null, processedAt: null }),
    ])

    expect(s.autoCount).toBe(1)
    expect(s.autoRate).toBe(50)
  })

  it('conjunto vazio não quebra — médias e taxa ficam nulas', () => {
    const s = summarize([])

    expect(s.total).toBe(0)
    expect(s.avgDecisionHours).toBeNull()
    expect(s.avgProcessHours).toBeNull()
    expect(s.autoRate).toBeNull()
  })

  it('conta devoluções sem NF anexada', () => {
    expect(summarize([row(), row({ hasInvoice: false })]).missingInvoice).toBe(1)
  })
})

describe('summarizeByDepositor', () => {
  it('agrupa por depositante e ordena por volume', () => {
    const groups = summarizeByDepositor([
      row({ depositorId: 'dep-1', depositorName: 'Acme Ltda' }),
      row({ depositorId: 'dep-2', depositorName: 'Beta SA', depositorCnpj: '99999999000199' }),
      row({ depositorId: 'dep-2', depositorName: 'Beta SA', depositorCnpj: '99999999000199' }),
    ])

    expect(groups.map((g) => g.depositorName)).toEqual(['Beta SA', 'Acme Ltda'])
    expect(groups[0].total).toBe(2)
    expect(groups[0].depositorCnpj).toBe('99999999000199')
  })

  it('devoluções sem depositante viram um grupo próprio', () => {
    const groups = summarizeByDepositor([
      row({ depositorId: null, depositorName: null, depositorCnpj: null }),
    ])

    expect(groups[0].depositorName).toBe('Sem depositante')
  })
})

describe('buildReturnsReport', () => {
  it('gera três abas no relatório completo', () => {
    const { base64 } = buildReturnsReport([row()], META)

    expect(sheetsOf(base64).names).toEqual(['Resumo', 'Devoluções', 'Por depositante'])
  })

  it('omite a aba por depositante quando o relatório é de um só', () => {
    const { base64 } = buildReturnsReport([row()], { ...META, depositorName: 'Acme Ltda' })

    expect(sheetsOf(base64).names).toEqual(['Resumo', 'Devoluções'])
  })

  it('o cabeçalho do Resumo declara período, critério e escopo', () => {
    const { base64 } = buildReturnsReport([row()], META)
    const cells = sheetsOf(base64).cellsOf('Resumo')
    const find = (label: string) => cells.find((r) => r[0] === label)?.[1]

    expect(find('Período')).toBe('01/07/2026 a 31/07/2026')
    expect(find('Critério')).toBe('Data de recebimento')
    expect(find('Depositante')).toBe('Todos')
    expect(find('Total de devoluções')).toBe(1)
    expect(String(find('Gerado em'))).toContain('Gerente Teste')
  })

  it('a aba detalhada traduz status, decisão e identificador', () => {
    const { base64 } = buildReturnsReport(
      [row({ identifierType: 'logistics_code', accessKey: null, logisticsCode: 'LR-42', hasInvoice: false })],
      META,
    )
    const [detail] = sheetsOf(base64).rowsOf('Devoluções')

    expect(detail['Tipo Identificador']).toBe('Código de Logística Reversa')
    expect(detail['Identificador']).toBe('Cód. Logística Reversa: LR-42')
    expect(detail['Status']).toBe('Processado')
    expect(detail['Decisão']).toBe('Estoque')
    expect(detail['Decidido por']).toBe('Cliente')
    expect(detail['Operador']).toBe('Operador Um')
    expect(detail['NF Original']).toBe('Não')
  })

  it('campos ausentes viram travessão em vez de célula vazia', () => {
    const { base64 } = buildReturnsReport(
      [row({ depositorName: null, finalCustomerName: null, operatorName: null, decision: null, decidedAt: null, decidedByType: null, processedAt: null })],
      META,
    )
    const [detail] = sheetsOf(base64).rowsOf('Devoluções')

    expect(detail['Depositante']).toBe('—')
    expect(detail['Cliente Final']).toBe('—')
    expect(detail['Data Decisão']).toBe('—')
    expect(detail['Data Tratativa']).toBe('—')
  })
})

describe('reportSlug / reportFilename', () => {
  it('normaliza a razão social e usa "todos" no relatório completo', () => {
    expect(reportSlug(null)).toBe('todos')
    expect(reportSlug('Ação & Cia Ltda.')).toBe('acao-cia-ltda')
    expect(reportSlug('###')).toBe('depositante')
  })

  it('nome do arquivo combina escopo e período', () => {
    expect(reportFilename(META)).toBe('relatorio-devolucoes-todos-2026-07.xlsx')
    expect(reportFilename({ ...META, depositorName: 'Acme Ltda' }))
      .toBe('relatorio-devolucoes-acme-ltda-2026-07.xlsx')
  })
})
