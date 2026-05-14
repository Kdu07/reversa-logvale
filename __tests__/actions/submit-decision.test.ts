import { describe, it, expect, vi, beforeEach } from 'vitest'
import { submitDecisionAction } from '@/app/(client)/cliente/actions'

// Mock supabase server client
const mockEq2   = vi.fn()
const mockEq1   = vi.fn().mockReturnValue({ eq: mockEq2 })
const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq1 })
const mockFrom   = vi.fn().mockReturnValue({ update: mockUpdate })

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({ from: mockFrom })),
}))

vi.mock('@/lib/supabase/get-current-user', () => ({
  getCurrentUser: vi.fn(),
}))

import { getCurrentUser } from '@/lib/supabase/get-current-user'

function mockClient(role: string) {
  vi.mocked(getCurrentUser).mockResolvedValue({
    id:      'user-1',
    email:   'test@test.com',
    profile: { id: 'user-1', role, active: true, full_name: 'Test', phone: null, terms_accepted_at: null, created_at: '' },
  } as never)
}

beforeEach(() => {
  vi.clearAllMocks()
  mockEq2.mockResolvedValue({ error: null })
})

describe('submitDecisionAction', () => {
  it('retorna {ok:true} para decisão válida com XML', async () => {
    mockClient('client')

    const result = await submitDecisionAction({
      returnId:             'ret-1',
      decision:             'return_to_stock',
      returnInvoiceXmlPath: 'decisions/ret-1/file.xml',
    })

    expect(result).toEqual({ ok: true })
    expect(mockUpdate).toHaveBeenCalled()
  })

  it('retorna {ok:true} para store_for_handling sem XML', async () => {
    mockClient('client')

    const result = await submitDecisionAction({
      returnId:             'ret-1',
      decision:             'store_for_handling',
      returnInvoiceXmlPath: null,
    })

    expect(result).toEqual({ ok: true })
  })

  it('retorna erro quando XML é obrigatório e está ausente', async () => {
    mockClient('client')

    const result = await submitDecisionAction({
      returnId:             'ret-1',
      decision:             'discard',
      returnInvoiceXmlPath: null,
    })

    expect(result).toHaveProperty('error')
    expect((result as { error: string }).error).toContain('XML')
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('retorna erro de acesso negado quando role não é client', async () => {
    mockClient('operator')

    const result = await submitDecisionAction({
      returnId:             'ret-1',
      decision:             'store_for_handling',
      returnInvoiceXmlPath: null,
    })

    expect(result).toEqual({ error: 'Acesso negado' })
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('retorna erro quando Supabase falha', async () => {
    mockClient('client')
    mockEq2.mockResolvedValue({ error: { message: 'DB error' } })

    const result = await submitDecisionAction({
      returnId:             'ret-1',
      decision:             'store_for_handling',
      returnInvoiceXmlPath: null,
    })

    expect(result).toEqual({ error: 'DB error' })
  })

  it('revalida paths corretos após sucesso', async () => {
    mockClient('client')
    const { revalidatePath } = await import('next/cache')

    await submitDecisionAction({
      returnId:             'ret-1',
      decision:             'store_for_handling',
      returnInvoiceXmlPath: null,
    })

    expect(revalidatePath).toHaveBeenCalledWith('/cliente')
    expect(revalidatePath).toHaveBeenCalledWith('/cliente/historico')
  })
})
