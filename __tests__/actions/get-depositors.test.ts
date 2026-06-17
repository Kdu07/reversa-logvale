import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getDepositorsAction } from '@/app/(manager)/admin/depositantes/actions'

const getCurrentUser = vi.fn()
vi.mock('@/lib/supabase/get-current-user', () => ({
  getCurrentUser: () => getCurrentUser(),
}))

let depositorsResult: { data: unknown; count?: number; error: unknown }
const ilikeCalls: unknown[][] = []

function builder() {
  const b: Record<string, unknown> = {}
  const chain = () => b
  for (const m of ['select', 'order', 'range']) b[m] = vi.fn(chain)
  b.ilike = vi.fn((c: string, v: unknown) => { ilikeCalls.push([c, v]); return b })
  b.then  = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
    Promise.resolve(depositorsResult).then(resolve, reject)
  return b
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({ from: () => builder() })),
}))

function asManager() {
  getCurrentUser.mockResolvedValue({
    id: 'm-1', email: 'm@logvale.com',
    profile: { id: 'm-1', role: 'manager', active: true, full_name: 'M', phone: null, terms_accepted_at: '2024-01-01', created_at: '' },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  ilikeCalls.length = 0
  asManager()
  depositorsResult = { data: [], count: 0, error: null }
})

describe('getDepositorsAction', () => {
  it('mapeia depositantes com os nomes dos clientes vinculados', async () => {
    depositorsResult = {
      data: [{
        id: 'dep-1', cnpj: '12345678000190', razao_social: 'Acme', active: true,
        client_depositors: [
          { profiles: { full_name: 'Cliente A' } },
          { profiles: null },
          { profiles: { full_name: 'Cliente B' } },
        ],
      }],
      count: 1, error: null,
    }

    const result = await getDepositorsAction()

    expect(result).not.toHaveProperty('error')
    const ok = result as unknown as { rows: Record<string, unknown>[]; total: number }
    expect(ok.total).toBe(1)
    expect(ok.rows[0]).toMatchObject({
      id: 'dep-1', razao_social: 'Acme',
      clientNames: ['Cliente A', 'Cliente B'], // nulls filtrados
    })
  })

  it('aplica busca por razão social via ilike', async () => {
    await getDepositorsAction({ search: '  Acme  ' })

    expect(ilikeCalls).toContainEqual(['razao_social', '%Acme%'])
  })

  it('não aplica ilike quando a busca é vazia', async () => {
    await getDepositorsAction({ search: '   ' })

    expect(ilikeCalls).toHaveLength(0)
  })

  it('propaga erro do banco', async () => {
    depositorsResult = { data: null, count: 0, error: new Error('db error') }

    const result = await getDepositorsAction()

    expect(result).toEqual({ error: 'db error' })
  })

  it('nega acesso a quem não é manager', async () => {
    getCurrentUser.mockResolvedValue({
      id: 'op-1', email: 'op@test.com',
      profile: { id: 'op-1', role: 'operator', active: true, full_name: 'Op', phone: null, terms_accepted_at: null, created_at: '' },
    })

    const result = await getDepositorsAction()

    expect(result).toEqual({ error: 'Acesso negado' })
  })
})
