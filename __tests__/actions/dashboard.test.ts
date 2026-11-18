import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getAdminDashboardAction } from '@/app/(manager)/admin/actions'
import { resolveDashboardFilters } from '@/lib/admin-dashboard/filters'

const mockRpc = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({ rpc: mockRpc })),
}))

vi.mock('@/lib/supabase/get-current-user', () => ({
  getCurrentUser: vi.fn(),
}))

import { getCurrentUser } from '@/lib/supabase/get-current-user'

const NOW     = new Date('2026-11-17T18:00:00Z')
const filters = resolveDashboardFilters({ period: '7d' }, NOW)

function asRole(role: 'manager' | 'operator') {
  vi.mocked(getCurrentUser).mockResolvedValue({
    id: 'u-1', email: 'u@logvale.com',
    profile: { id: 'u-1', role, active: true, full_name: 'U', phone: null, terms_accepted_at: '2024-01-01', created_at: '' },
  } as never)
}

const RPC_DATA = {
  attention: {
    awaiting: { total: 1, onTime: 1, dueSoon: 0, overdue: 0, noDeadline: 0 },
    decidedBacklog: { total: 0, oldestHours: null, byDecision: [] },
    withoutKey: { awaiting: 0, decided: 0 },
    warnings24h: 0, urgent: [], urgentDepositors: [],
  },
  volume: { current: { received: 3 }, previous: {}, series: [], byDecision: [] },
  quality: {
    conditions: {
      good: { returns: 3, items: 3 }, damaged: { returns: 0, items: 0 },
      empty: { returns: 0, items: 0 }, mismatched: { returns: 0, items: 0 },
      notEvaluated: 0, totalItems: 3,
    },
    identification: [],
  },
  depositors: [], team: [], depositorOptions: [],
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('getAdminDashboardAction', () => {
  it('nega acesso a quem não é gerente, sem ir ao banco', async () => {
    asRole('operator')
    expect(await getAdminDashboardAction(filters)).toEqual({ error: 'Acesso negado' })
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it('chama get_admin_dashboard com o período em São Paulo e mapeia a resposta', async () => {
    asRole('manager')
    mockRpc.mockResolvedValue({ data: RPC_DATA, error: null })

    const result = await getAdminDashboardAction(filters)

    expect(mockRpc).toHaveBeenCalledWith('get_admin_dashboard', expect.objectContaining({
      p_from: '2026-11-11T00:00:00-03:00',
      p_to:   '2026-11-18T00:00:00-03:00',
      p_bucket: 'day',
    }))
    expect(result).not.toHaveProperty('error')
    expect((result as { volume: { received: unknown } }).volume.received).toEqual({ value: 3, previous: 0 })
  })

  it('propaga o erro da RPC', async () => {
    asRole('manager')
    mockRpc.mockResolvedValue({ data: null, error: { message: 'Access denied' } })
    expect(await getAdminDashboardAction(filters)).toEqual({ error: 'Access denied' })
  })

  it('trata resposta vazia e exceções', async () => {
    asRole('manager')
    mockRpc.mockResolvedValueOnce({ data: null, error: null })
    expect(await getAdminDashboardAction(filters)).toEqual({ error: 'Resposta vazia do banco' })

    mockRpc.mockRejectedValueOnce(new Error('rede'))
    expect(await getAdminDashboardAction(filters)).toEqual({ error: 'rede' })
  })
})
