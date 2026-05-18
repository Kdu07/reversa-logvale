import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getDashboardStatsAction } from '@/app/(manager)/admin/actions'

const mockRpc = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({ rpc: mockRpc })),
}))

vi.mock('@/lib/supabase/get-current-user', () => ({
  getCurrentUser: vi.fn(),
}))

import { getCurrentUser } from '@/lib/supabase/get-current-user'

function mockManager() {
  vi.mocked(getCurrentUser).mockResolvedValue({
    id:      'm-1',
    email:   'm@logvale.com',
    profile: { id: 'm-1', role: 'manager', active: true, full_name: 'Manager', phone: null, terms_accepted_at: '2024-01-01', created_at: '' },
  } as never)
}

function mockRpcResponse(overrides: Record<string, unknown> = {}) {
  mockRpc.mockResolvedValue({
    data: {
      counts: {
        today:              5,
        last7d:             20,
        last30d:            80,
        cnt_awaiting:       10,
        cnt_decided:        15,
        cnt_processed:      55,
        cnt_rts:            8,
        cnt_sfh:            4,
        cnt_disc:           2,
        cnt_repk:           1,
        avg_decision_hours: 3.5,
        avg_process_hours:  1.2,
        decided_total:      10,
        decided_auto:       2,
        ...overrides,
      },
      topClients:    [{ name: 'Cliente A', count: 5 }],
      urgentPending: [{ id: 'r1', rv: 'RV-001', receivedAt: '2024-01-01T00:00:00Z', depositorName: 'TechStore' }],
    },
    error: null,
  })
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('getDashboardStatsAction', () => {
  it('retorna {error} quando usuário não é manager', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({
      id:      'op-1',
      email:   'op@test.com',
      profile: { id: 'op-1', role: 'operator', active: true, full_name: 'Op', phone: null, terms_accepted_at: null, created_at: '' },
    } as never)

    const result = await getDashboardStatsAction()

    expect(result).toEqual({ error: 'Acesso negado' })
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it('retorna totals mapeados corretamente do RPC', async () => {
    mockManager()
    mockRpcResponse()

    const result = await getDashboardStatsAction()

    expect(result).not.toHaveProperty('error')
    const stats = result as Exclude<typeof result, { error: string }>
    expect(stats.totals).toEqual({ today: 5, last7d: 20, last30d: 80 })
  })

  it('retorna byStatus com 3 itens mapeados corretamente', async () => {
    mockManager()
    mockRpcResponse()

    const result = await getDashboardStatsAction()

    const stats = result as Exclude<typeof result, { error: string }>
    expect(stats.byStatus).toEqual([
      { status: 'awaiting_decision', count: 10 },
      { status: 'decided',           count: 15 },
      { status: 'processed',         count: 55 },
    ])
  })

  it('retorna byDecision com 4 itens mapeados corretamente', async () => {
    mockManager()
    mockRpcResponse()

    const result = await getDashboardStatsAction()

    const stats = result as Exclude<typeof result, { error: string }>
    expect(stats.byDecision).toEqual([
      { decision: 'return_to_stock',    count: 8 },
      { decision: 'store_for_handling', count: 4 },
      { decision: 'discard',            count: 2 },
      { decision: 'repackage',          count: 1 },
    ])
  })

  it('calcula autoRate corretamente (2 auto / 10 total = 20%)', async () => {
    mockManager()
    mockRpcResponse({ decided_total: 10, decided_auto: 2 })

    const result = await getDashboardStatsAction()

    const stats = result as Exclude<typeof result, { error: string }>
    expect(stats.autoRate).toBe(20)
  })

  it('retorna autoRate null quando decided_total é 0', async () => {
    mockManager()
    mockRpcResponse({ decided_total: 0, decided_auto: 0 })

    const result = await getDashboardStatsAction()

    const stats = result as Exclude<typeof result, { error: string }>
    expect(stats.autoRate).toBeNull()
  })

  it('repassa topClients e urgentPending direto do RPC', async () => {
    mockManager()
    mockRpcResponse()

    const result = await getDashboardStatsAction()

    const stats = result as Exclude<typeof result, { error: string }>
    expect(stats.topClients).toEqual([{ name: 'Cliente A', count: 5 }])
    expect(stats.urgentPending).toEqual([
      { id: 'r1', rv: 'RV-001', receivedAt: '2024-01-01T00:00:00Z', depositorName: 'TechStore' },
    ])
  })

  it('retorna {error} quando RPC falha', async () => {
    mockManager()
    mockRpc.mockResolvedValue({ data: null, error: { message: 'RPC failed' } })

    const result = await getDashboardStatsAction()

    expect(result).toEqual({ error: 'RPC failed' })
  })

  it('repassa avgDecisionHours e avgProcessHours do RPC', async () => {
    mockManager()
    mockRpcResponse({ avg_decision_hours: 3.5, avg_process_hours: 1.2 })

    const result = await getDashboardStatsAction()

    const stats = result as Exclude<typeof result, { error: string }>
    expect(stats.avgDecisionHours).toBe(3.5)
    expect(stats.avgProcessHours).toBe(1.2)
  })
})
