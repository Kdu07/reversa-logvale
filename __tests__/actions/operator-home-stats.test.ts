import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getOperatorHomeStatsAction } from '@/app/(operator)/operador/actions'

const getCurrentUser = vi.fn()
vi.mock('@/lib/supabase/get-current-user', () => ({
  getCurrentUser: () => getCurrentUser(),
}))

// Three parallel queries resolved in construction order: today, week, urgent
let queue: unknown[]
let idx = 0

function builder() {
  const myIdx = idx++
  const b: Record<string, unknown> = {}
  const chain = () => b
  for (const m of ['select', 'eq', 'gte', 'order', 'limit']) b[m] = vi.fn(chain)
  b.then = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
    Promise.resolve(queue[myIdx]).then(resolve, reject)
  return b
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({ from: () => builder() })),
}))

beforeEach(() => {
  vi.clearAllMocks()
  idx = 0
  getCurrentUser.mockResolvedValue({
    id: 'op-1', email: 'op@test.com',
    profile: { id: 'op-1', role: 'operator', active: true, full_name: 'Op', phone: null, terms_accepted_at: null, created_at: '' },
  })
  queue = [{ count: 0 }, { count: 0 }, { data: [], count: 0 }]
})

describe('getOperatorHomeStatsAction', () => {
  it('agrega contagens e mapeia tratativas urgentes', async () => {
    queue = [
      { count: 4 },
      { count: 12 },
      {
        data: [{
          id: 'r-1', rv: 'RV-1', decision: 'store_for_handling', decided_at: '2025-01-02',
          depositors: [{ razao_social: 'Acme' }],
        }],
        count: 3,
      },
    ]

    const result = await getOperatorHomeStatsAction()

    expect(result).toMatchObject({
      todayCount: 4,
      weekCount: 12,
      pendingCount: 3,
    })
    const ok = result as { urgentTratativas: { depositorName: string | null }[] }
    expect(ok.urgentTratativas[0]).toMatchObject({ id: 'r-1', rv: 'RV-1', depositorName: 'Acme' })
  })

  it('usa null quando o depositante não está presente', async () => {
    queue = [
      { count: 1 },
      { count: 1 },
      { data: [{ id: 'r-2', rv: 'RV-2', decision: 'discard', decided_at: '2025-01-02', depositors: null }], count: 1 },
    ]

    const result = await getOperatorHomeStatsAction()

    const ok = result as { urgentTratativas: { depositorName: string | null }[] }
    expect(ok.urgentTratativas[0].depositorName).toBeNull()
  })

  it('retorna erro quando getCurrentUser lança', async () => {
    getCurrentUser.mockRejectedValue(new Error('not authenticated'))

    const result = await getOperatorHomeStatsAction()

    expect(result).toEqual({ error: 'not authenticated' })
  })
})
