import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getDepositorsAction } from '@/app/(operator)/operador/recebimento/actions'

// ── auth ─────────────────────────────────────────────────────────────
const getCurrentUser = vi.fn()
vi.mock('@/lib/supabase/get-current-user', () => ({
  getCurrentUser: () => getCurrentUser(),
}))

vi.mock('@/lib/integrations/nfeio', () => ({ lookupInvoice: vi.fn() }))

// ── Supabase server client ───────────────────────────────────────────
let depositorsResult: { data: unknown; error: unknown }

function depositorsBuilder() {
  const b: Record<string, unknown> = {}
  const chain = () => b
  for (const m of ['select', 'eq', 'order']) b[m] = vi.fn(chain)
  b.then = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
    Promise.resolve(depositorsResult).then(resolve, reject)
  return b
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({
    from: () => depositorsBuilder(),
  })),
}))

beforeEach(() => {
  vi.clearAllMocks()
  getCurrentUser.mockResolvedValue({
    id: 'op-1', email: 'op@test.com',
    profile: { id: 'op-1', role: 'operator', active: true, full_name: 'Op', phone: null, terms_accepted_at: null, created_at: '' },
  })
  depositorsResult = { data: [], error: null }
})

describe('getDepositorsAction', () => {
  it('retorna depositantes ativos', async () => {
    depositorsResult = { data: [{ id: 'dep-1', razao_social: 'Acme', cnpj: '123' }], error: null }

    const result = await getDepositorsAction()

    expect(result).toEqual({ data: [{ id: 'dep-1', razao_social: 'Acme', cnpj: '123' }] })
  })

  it('propaga erro do banco', async () => {
    depositorsResult = { data: null, error: { message: 'query failed' } }

    const result = await getDepositorsAction()

    expect(result).toEqual({ error: 'query failed' })
  })

  it('retorna erro quando getCurrentUser lança (não autenticado)', async () => {
    getCurrentUser.mockRejectedValue(new Error('not authenticated'))

    const result = await getDepositorsAction()

    expect(result).toEqual({ error: 'not authenticated' })
  })
})
