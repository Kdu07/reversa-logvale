import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  getClientReturnsAction,
  getClientHistoryAction,
  exportHistoryAction,
} from '@/app/(client)/cliente/actions'

// ── auth ─────────────────────────────────────────────────────────────
const getCurrentUser = vi.fn()
vi.mock('@/lib/supabase/get-current-user', () => ({
  getCurrentUser: () => getCurrentUser(),
}))

const isSuperUser = vi.fn()
vi.mock('@/lib/auth/super', () => ({ isSuperUser: (u: unknown) => isSuperUser(u) }))

// signed URLs are not the subject here — return empty maps
vi.mock('@/lib/supabase/storage', () => ({
  buildSignedUrlMap: vi.fn().mockResolvedValue(new Map()),
}))

// ── Supabase server client (thenable query builder) ──────────────────
let returnsResult:    { data: unknown; count?: number; error: unknown }
let cdResult:         { data: unknown; error?: unknown }
let depositorsResult: { data: unknown; error?: unknown }

function resultFor(table: string) {
  if (table === 'returns')           return returnsResult
  if (table === 'client_depositors') return cdResult
  if (table === 'depositors')        return depositorsResult
  return { data: null, error: null }
}

function builder(table: string) {
  const b: Record<string, unknown> = {}
  const chain = () => b
  for (const m of ['select', 'eq', 'neq', 'gte', 'lte', 'ilike', 'order', 'range']) {
    b[m] = vi.fn(chain)
  }
  b.then = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
    Promise.resolve(resultFor(table)).then(resolve, reject)
  return b
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({ from: (t: string) => builder(t) })),
}))

function asClient(id = 'client-1') {
  getCurrentUser.mockResolvedValue({
    id, email: 'cliente@test.com',
    profile: { id, role: 'client', active: true, full_name: 'Cliente', phone: null, terms_accepted_at: '2024-01-01', created_at: '' },
  })
  isSuperUser.mockReturnValue(false)
}

beforeEach(() => {
  vi.clearAllMocks()
  asClient()
  returnsResult    = { data: [], count: 0, error: null }
  cdResult         = { data: [], error: null }
  depositorsResult = { data: [], error: null }
})

// ─────────────────────────────────────────────────────────────────────
describe('getClientReturnsAction', () => {
  it('nega acesso a quem não é client nem super', async () => {
    getCurrentUser.mockResolvedValue({
      id: 'op-1', email: 'op@test.com',
      profile: { id: 'op-1', role: 'operator', active: true, full_name: 'Op', phone: null, terms_accepted_at: null, created_at: '' },
    })

    const result = await getClientReturnsAction()

    expect(result).toEqual({ error: 'Acesso negado' })
  })

  it('lista de depositantes do cliente vem escopada por client_depositors', async () => {
    cdResult = {
      data: [{ depositor_id: 'dep-1', depositors: { razao_social: 'Acme Ltda' } }],
      error: null,
    }
    returnsResult = {
      data: [{
        id: 'r-1', identifier_type: 'access_key', access_key: '4'.repeat(44),
        postal_code: null, illegible_token: null, rv: 'RV-1', item_count: 2,
        received_at: '2025-01-01', depositor_id: 'dep-1', invoice_xml_url: null,
        depositors: { razao_social: 'Acme Ltda' }, return_photos: [],
      }],
      count: 1, error: null,
    }

    const result = await getClientReturnsAction()

    expect(result).not.toHaveProperty('error')
    const ok = result as { rows: unknown[]; total: number; depositors: { id: string; name: string }[] }
    expect(ok.total).toBe(1)
    expect(ok.depositors).toEqual([{ id: 'dep-1', name: 'Acme Ltda' }])
    expect(ok.rows[0]).toMatchObject({ id: 'r-1', depositorName: 'Acme Ltda' })
  })

  it('super user recebe todos os depositantes ativos', async () => {
    isSuperUser.mockReturnValue(true)
    depositorsResult = {
      data: [{ id: 'dep-1', razao_social: 'Acme' }, { id: 'dep-2', razao_social: 'Beta' }],
      error: null,
    }

    const result = await getClientReturnsAction()

    const ok = result as { depositors: { id: string; name: string }[] }
    expect(ok.depositors).toEqual([
      { id: 'dep-1', name: 'Acme' },
      { id: 'dep-2', name: 'Beta' },
    ])
  })

  it('aplica filtros de depositante e período', async () => {
    const filterCalls: Record<string, unknown[]> = {}
    vi.mocked((await import('@/lib/supabase/server')).createClient).mockReturnValueOnce({
      from: () => {
        const b: Record<string, unknown> = {}
        const chain = () => b
        b.select = vi.fn(chain)
        b.order  = vi.fn(chain)
        b.range  = vi.fn(chain)
        b.eq  = vi.fn((col: string, val: unknown) => { (filterCalls.eq  ??= []).push([col, val]); return b })
        b.gte = vi.fn((col: string, val: unknown) => { (filterCalls.gte ??= []).push([col, val]); return b })
        b.lte = vi.fn((col: string, val: unknown) => { (filterCalls.lte ??= []).push([col, val]); return b })
        b.then = (resolve: (v: unknown) => unknown) => Promise.resolve({ data: [], count: 0, error: null }).then(resolve)
        return b
      },
    } as never)

    await getClientReturnsAction({ depositorId: 'dep-9', from: '2025-01-01', to: '2025-02-01' })

    expect(filterCalls.eq).toContainEqual(['depositor_id', 'dep-9'])
    expect(filterCalls.gte).toContainEqual(['received_at', '2025-01-01'])
    expect(filterCalls.lte).toContainEqual(['received_at', '2025-02-01'])
  })

  it('propaga erro do banco', async () => {
    returnsResult = { data: null, count: 0, error: { message: 'rls denied' } }

    const result = await getClientReturnsAction()

    expect(result).toEqual({ error: 'rls denied' })
  })
})

// ─────────────────────────────────────────────────────────────────────
describe('getClientHistoryAction', () => {
  it('mapeia campos de decisão dos returns "decided"', async () => {
    returnsResult = {
      data: [{
        id: 'r-9', identifier_type: 'postal_code', access_key: null,
        postal_code: '01234-567', illegible_token: null, rv: 'RV-9', item_count: 1,
        received_at: '2025-01-01', depositor_id: 'dep-1', invoice_xml_url: null,
        decision: 'return_to_stock', decided_at: '2025-01-03', decided_by_type: 'client',
        depositors: { razao_social: 'Acme' }, return_photos: [],
      }],
      count: 1, error: null,
    }

    const result = await getClientHistoryAction()

    const ok = result as unknown as { rows: Record<string, unknown>[] }
    expect(ok.rows[0]).toMatchObject({
      id: 'r-9', decision: 'return_to_stock', decidedByType: 'client', decidedAt: '2025-01-03',
    })
  })

  it('nega acesso a quem não é client nem super', async () => {
    getCurrentUser.mockResolvedValue({
      id: 'op-1', email: 'op@test.com',
      profile: { id: 'op-1', role: 'operator', active: true, full_name: 'Op', phone: null, terms_accepted_at: null, created_at: '' },
    })

    const result = await getClientHistoryAction()

    expect(result).toEqual({ error: 'Acesso negado' })
  })
})

// ─────────────────────────────────────────────────────────────────────
describe('exportHistoryAction (isolamento de dados)', () => {
  const RETURNS = [
    { id: 'r-own',   identifier_type: 'access_key', access_key: '1'.repeat(44), postal_code: null, illegible_token: null, rv: 'RV-OWN',   item_count: 1, received_at: '2025-01-01', depositor_id: 'dep-allowed', decision: 'discard',         decided_at: '2025-01-02', decided_by_type: 'client', status: 'decided', depositors: { razao_social: 'Minha Empresa' } },
    { id: 'r-other', identifier_type: 'access_key', access_key: '2'.repeat(44), postal_code: null, illegible_token: null, rv: 'RV-OTHER', item_count: 1, received_at: '2025-01-01', depositor_id: 'dep-foreign', decision: 'return_to_stock', decided_at: '2025-01-02', decided_by_type: 'auto',   status: 'decided', depositors: { razao_social: 'Empresa Alheia' } },
  ]

  it('exclui devoluções de depositantes fora do escopo do cliente', async () => {
    returnsResult = { data: RETURNS, error: null }
    cdResult      = { data: [{ depositor_id: 'dep-allowed' }], error: null }

    const result = await exportHistoryAction()

    expect(result).not.toHaveProperty('error')
    const ok = result as { base64: string; filename: string }
    expect(ok.filename).toBe(`historico-devolucoes-${new Date().toISOString().slice(0, 10)}.xlsx`)

    const XLSX  = await import('xlsx')
    const wb    = XLSX.read(Buffer.from(ok.base64, 'base64'), { type: 'buffer' })
    const sheet = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[wb.SheetNames[0]])
    const rvs   = sheet.map((r) => r['RV'])

    expect(rvs).toContain('RV-OWN')
    expect(rvs).not.toContain('RV-OTHER') // depositante alheio filtrado
  })

  it('super user recebe todas as devoluções (bypass do filtro)', async () => {
    isSuperUser.mockReturnValue(true)
    returnsResult = { data: RETURNS, error: null }
    cdResult      = { data: [], error: null } // nenhum vínculo, mas super ignora

    const result = await exportHistoryAction()

    const ok    = result as { base64: string }
    const XLSX  = await import('xlsx')
    const wb    = XLSX.read(Buffer.from(ok.base64, 'base64'), { type: 'buffer' })
    const sheet = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[wb.SheetNames[0]])
    const rvs   = sheet.map((r) => r['RV'])

    expect(rvs).toEqual(expect.arrayContaining(['RV-OWN', 'RV-OTHER']))
  })

  it('nega acesso a quem não é client nem super', async () => {
    getCurrentUser.mockResolvedValue({
      id: 'op-1', email: 'op@test.com',
      profile: { id: 'op-1', role: 'operator', active: true, full_name: 'Op', phone: null, terms_accepted_at: null, created_at: '' },
    })

    const result = await exportHistoryAction()

    expect(result).toEqual({ error: 'Acesso negado' })
  })

  it('propaga erro do banco', async () => {
    returnsResult = { data: null, error: { message: 'query failed' } }

    const result = await exportHistoryAction()

    expect(result).toEqual({ error: 'query failed' })
  })
})
