import { describe, it, expect, vi, beforeEach } from 'vitest'
import { revertReturnStatusAction } from '@/app/(manager)/admin/devolucoes/actions'

vi.mock('@/lib/supabase/get-current-user', () => ({
  getCurrentUser: vi.fn().mockResolvedValue({
    id:      'm-1',
    email:   'm@logvale.com',
    profile: { id: 'm-1', role: 'manager', active: true, full_name: 'Manager', phone: null, terms_accepted_at: '2024-01-01', created_at: '' },
  }),
}))

vi.mock('@/lib/supabase/storage', () => ({
  buildSignedUrlMap: vi.fn().mockResolvedValue(new Map()),
}))

const mockSingle   = vi.fn()
const mockSelectEq = vi.fn().mockReturnValue({ single: mockSingle })
const mockSelect   = vi.fn().mockReturnValue({ eq: mockSelectEq })
const mockUpdateEq = vi.fn().mockResolvedValue({ error: null })
const mockUpdate   = vi.fn().mockReturnValue({ eq: mockUpdateEq })
const mockFrom     = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({ from: mockFrom })),
}))

beforeEach(() => {
  vi.clearAllMocks()
  mockUpdateEq.mockResolvedValue({ error: null })
  mockFrom.mockImplementation(() => ({
    select: mockSelect,
    update: mockUpdate,
  }))
})

describe('revertReturnStatusAction', () => {
  it('reverte decided → awaiting_decision limpando campos de decisão', async () => {
    mockSingle.mockResolvedValue({ data: { status: 'decided' }, error: null })

    const result = await revertReturnStatusAction('ret-1')

    expect(result).toEqual({ ok: true })
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        status:                 'awaiting_decision',
        decision:               null,
        decided_at:             null,
        decided_by:             null,
        decided_by_type:        null,
        return_invoice_xml_url: null,
      }),
    )
    expect(mockUpdateEq).toHaveBeenCalledWith('id', 'ret-1')
  })

  it('reverte processed → decided limpando campos de processamento', async () => {
    mockSingle.mockResolvedValue({ data: { status: 'processed' }, error: null })

    const result = await revertReturnStatusAction('ret-2')

    expect(result).toEqual({ ok: true })
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        status:       'decided',
        processed_at: null,
        processed_by: null,
      }),
    )
  })

  it('retorna erro para status awaiting_decision (não pode reverter)', async () => {
    mockSingle.mockResolvedValue({ data: { status: 'awaiting_decision' }, error: null })

    const result = await revertReturnStatusAction('ret-3')

    expect(result).toHaveProperty('error')
    expect((result as { error: string }).error).toContain('não pode ser revertido')
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('retorna erro quando fetch do status falha', async () => {
    mockSingle.mockResolvedValue({ data: null, error: new Error('not found') })

    const result = await revertReturnStatusAction('ret-xxx')

    expect(result).toEqual({ error: 'not found' })
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('retorna erro quando update falha', async () => {
    mockSingle.mockResolvedValue({ data: { status: 'decided' }, error: null })
    mockUpdateEq.mockResolvedValue({ error: new Error('update failed') })

    const result = await revertReturnStatusAction('ret-4')

    expect(result).toEqual({ error: 'update failed' })
  })

  it('revalida /admin/devolucoes após reversão bem-sucedida', async () => {
    mockSingle.mockResolvedValue({ data: { status: 'decided' }, error: null })
    const { revalidatePath } = await import('next/cache')

    await revertReturnStatusAction('ret-1')

    expect(revalidatePath).toHaveBeenCalledWith('/admin/devolucoes')
  })
})
