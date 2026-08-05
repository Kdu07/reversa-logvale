import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as XLSX from 'xlsx'
import {
  generateReturnsReportAction,
  getReportDepositorsAction,
} from '@/app/(manager)/admin/relatorios/actions'

// ── auth ─────────────────────────────────────────────────────────────
const getCurrentUser = vi.fn()
vi.mock('@/lib/supabase/get-current-user', () => ({
  getCurrentUser: () => getCurrentUser(),
}))

// ── Supabase server client (query builder thenable) ───────────────────
type Result = { data: unknown; error: unknown }

/** Chamadas registradas por tabela, para inspecionar os filtros aplicados. */
let calls: Record<string, { method: string; args: unknown[] }[]>
/** Lotes devolvidos por `returns`, na ordem das requisições (paginação). */
let returnsBatches: Result[]
let depositorsResult: Result
let depositorSingleResult: Result

function builder(table: string) {
  const b: Record<string, unknown> = {}
  const chain = (method: string) => (...args: unknown[]) => {
    calls[table] = calls[table] ?? []
    calls[table].push({ method, args })
    return b
  }
  for (const m of ['select', 'eq', 'gte', 'lt', 'order', 'range']) b[m] = vi.fn(chain(m))

  b.single = vi.fn(() => Promise.resolve(depositorSingleResult))
  b.then = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) => {
    const value = table === 'returns'
      ? (returnsBatches.shift() ?? { data: [], error: null })
      : depositorsResult
    return Promise.resolve(value).then(resolve, reject)
  }
  return b
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({ from: (t: string) => builder(t) })),
}))

function asManager() {
  getCurrentUser.mockResolvedValue({
    id: 'mgr-1', email: 'gerente@test.com',
    profile: { id: 'mgr-1', role: 'manager', active: true, full_name: 'Gerente', phone: null, terms_accepted_at: '2024-01-01', created_at: '' },
  })
}

function rawReturn(overrides: Record<string, unknown> = {}) {
  return {
    rv: 'RV-1', identifier_type: 'access_key', access_key: '4'.repeat(44),
    postal_code: null, logistics_code: null, illegible_token: null,
    item_count: 2, status: 'decided', decision: 'discard', decided_by_type: 'auto',
    received_at: '2026-07-10T12:00:00-03:00', decided_at: '2026-07-13T12:00:00-03:00',
    processed_at: null, final_customer_name: 'Cliente Final',
    invoice_xml_url: 'ak/123.xml', invoice_pdf_url: null, depositor_id: 'dep-1',
    depositors: { razao_social: 'Acme Ltda', cnpj: '12345678000199' },
    profiles: { full_name: 'Operador Um' },
    ...overrides,
  }
}

const JULY = { period: { kind: 'month', year: 2026, month: 7 } } as const

beforeEach(() => {
  vi.clearAllMocks()
  asManager()
  calls = {}
  returnsBatches = [{ data: [], error: null }]
  depositorsResult = { data: [], error: null }
  depositorSingleResult = { data: { razao_social: 'Acme Ltda' }, error: null }
})

// ─────────────────────────────────────────────────────────────────────
describe('getReportDepositorsAction', () => {
  it('nega acesso a quem não é gerente', async () => {
    getCurrentUser.mockResolvedValue({
      id: 'cli-1', email: 'cliente@test.com',
      profile: { id: 'cli-1', role: 'client', active: true, full_name: 'Cliente', phone: null, terms_accepted_at: null, created_at: '' },
    })

    expect(await getReportDepositorsAction()).toEqual({ error: 'Acesso negado' })
  })

  it('lista apenas depositantes ativos', async () => {
    depositorsResult = { data: [{ id: 'dep-1', razao_social: 'Acme Ltda' }], error: null }

    const result = await getReportDepositorsAction()

    expect(result).toEqual({ rows: [{ id: 'dep-1', name: 'Acme Ltda' }] })
    expect(calls.depositors).toContainEqual({ method: 'eq', args: ['active', true] })
  })
})

describe('generateReturnsReportAction', () => {
  it('nega acesso a operador', async () => {
    getCurrentUser.mockResolvedValue({
      id: 'op-1', email: 'op@test.com',
      profile: { id: 'op-1', role: 'operator', active: true, full_name: 'Op', phone: null, terms_accepted_at: null, created_at: '' },
    })

    expect(await generateReturnsReportAction(JULY)).toEqual({ error: 'Acesso negado' })
  })

  it('filtra pelo mês fechado no fuso de São Paulo', async () => {
    returnsBatches = [{ data: [rawReturn()], error: null }]

    await generateReturnsReportAction(JULY)

    expect(calls.returns).toContainEqual({
      method: 'gte', args: ['received_at', '2026-07-01T00:00:00-03:00'],
    })
    expect(calls.returns).toContainEqual({
      method: 'lt', args: ['received_at', '2026-08-01T00:00:00-03:00'],
    })
  })

  it('aplica os filtros de depositante e status', async () => {
    returnsBatches = [{ data: [rawReturn()], error: null }]

    await generateReturnsReportAction({ ...JULY, depositorId: 'dep-1', status: 'decided' })

    expect(calls.returns).toContainEqual({ method: 'eq', args: ['depositor_id', 'dep-1'] })
    expect(calls.returns).toContainEqual({ method: 'eq', args: ['status', 'decided'] })
  })

  it('sem devoluções no período, informa em vez de baixar planilha vazia', async () => {
    const result = await generateReturnsReportAction(JULY)

    expect(result).toHaveProperty('empty', true)
    expect((result as { message: string }).message).toContain('01/07/2026 a 31/07/2026')
  })

  it('pagina além de 1000 linhas em vez de truncar', async () => {
    const full  = Array.from({ length: 1000 }, (_, i) => rawReturn({ rv: `RV-${i}` }))
    const tail  = Array.from({ length: 7 },    (_, i) => rawReturn({ rv: `RV-t${i}` }))
    returnsBatches = [
      { data: full, error: null },
      { data: tail, error: null },
    ]

    const result = await generateReturnsReportAction(JULY)

    expect(result).toHaveProperty('rowCount', 1007)
    const ranges = calls.returns.filter((c) => c.method === 'range').map((c) => c.args)
    expect(ranges).toEqual([[0, 999], [1000, 1999]])
  })

  it('o arquivo gerado carrega as linhas e o nome do depositante', async () => {
    returnsBatches = [{ data: [rawReturn()], error: null }]

    const result = await generateReturnsReportAction({ ...JULY, depositorId: 'dep-1' })

    expect(result).not.toHaveProperty('error')
    const ok = result as { base64: string; filename: string; rowCount: number }
    expect(ok.filename).toBe('relatorio-devolucoes-acme-ltda-2026-07.xlsx')
    expect(ok.rowCount).toBe(1)

    const wb = XLSX.read(Buffer.from(ok.base64, 'base64'), { type: 'buffer' })
    expect(wb.SheetNames).toEqual(['Resumo', 'Devoluções'])
    const [detail] = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets['Devoluções'])
    expect(detail['RV']).toBe('RV-1')
    expect(detail['Depositante']).toBe('Acme Ltda')
    expect(detail['NF Original']).toBe('Sim')
  })

  it('período inválido volta como erro tratado', async () => {
    const result = await generateReturnsReportAction({
      period: { kind: 'custom', from: '2026-07-31', to: '2026-07-01' },
    })

    expect(result).toEqual({ error: 'A data inicial não pode ser posterior à final' })
  })

  it('erro do banco não vaza exceção', async () => {
    returnsBatches = [{ data: null, error: { message: 'falha de conexão' } }]

    expect(await generateReturnsReportAction(JULY)).toEqual({ error: 'falha de conexão' })
  })
})
