import { describe, it, expect, vi, beforeEach } from 'vitest'
import { processReturnAction } from '@/app/(operator)/operador/tratativas/actions'

const mockEq2    = vi.fn()
const mockEq1    = vi.fn().mockReturnValue({ eq: mockEq2 })
const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq1 })
const mockFrom   = vi.fn().mockReturnValue({ update: mockUpdate })

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({ from: mockFrom })),
}))

vi.mock('@/lib/supabase/get-current-user', () => ({
  getCurrentUser: vi.fn(),
}))

vi.mock('@/lib/supabase/storage', () => ({
  buildSignedUrlMap: vi.fn().mockResolvedValue(new Map()),
}))

import { getCurrentUser } from '@/lib/supabase/get-current-user'

function mockOperator() {
  vi.mocked(getCurrentUser).mockResolvedValue({
    id:      'op-1',
    email:   'op@test.com',
    profile: { id: 'op-1', role: 'operator', active: true, full_name: 'Op', phone: null, terms_accepted_at: null, created_at: '' },
  } as never)
}

beforeEach(() => {
  vi.clearAllMocks()
  mockEq2.mockResolvedValue({ error: null })
})

describe('processReturnAction', () => {
  it('retorna {ok:true} quando processamento bem-sucedido', async () => {
    mockOperator()

    const result = await processReturnAction('ret-1')

    expect(result).toEqual({ ok: true })
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'processed', processed_by: 'op-1' }),
    )
  })

  it('retorna erro de acesso negado quando role não é operator', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({
      id:      'c-1',
      email:   'c@test.com',
      profile: { id: 'c-1', role: 'client', active: true, full_name: 'C', phone: null, terms_accepted_at: null, created_at: '' },
    } as never)

    const result = await processReturnAction('ret-1')

    expect(result).toEqual({ error: 'Acesso negado' })
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('retorna erro quando Supabase falha', async () => {
    mockOperator()
    mockEq2.mockResolvedValue({ error: { message: 'update failed' } })

    const result = await processReturnAction('ret-1')

    expect(result).toEqual({ error: 'update failed' })
  })

  it('usa eq status=decided para idempotência (já processado = 0 rows, sem erro)', async () => {
    mockOperator()
    // Supabase retorna error:null mesmo quando 0 rows foram afetadas
    mockEq2.mockResolvedValue({ error: null })

    const result = await processReturnAction('ret-1')

    expect(result).toEqual({ ok: true })
    // Verifica que o segundo .eq() filtra por status='decided'
    expect(mockEq1).toHaveBeenCalledWith('id', 'ret-1')
    expect(mockEq2).toHaveBeenCalledWith('status', 'decided')
  })
})
