import { describe, it, expect, vi, beforeEach } from 'vitest'
import { deleteReturnAction } from '@/app/(manager)/admin/devolucoes/actions'

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
const mockDeleteEq = vi.fn().mockResolvedValue({ error: null })
const mockRemove   = vi.fn().mockResolvedValue({ error: null })
const storageFrom  = vi.fn(() => ({ remove: mockRemove }))

const mockFrom = vi.fn(() => ({
  select: vi.fn(() => ({ eq: vi.fn(() => ({ single: mockSingle })) })),
  delete: vi.fn(() => ({ eq: mockDeleteEq })),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({ from: mockFrom, storage: { from: storageFrom } })),
}))

beforeEach(() => {
  vi.clearAllMocks()
  mockDeleteEq.mockResolvedValue({ error: null })
  mockRemove.mockResolvedValue({ error: null })
})

describe('deleteReturnAction', () => {
  it('apaga o registro e limpa fotos + XML de devolução do storage', async () => {
    mockSingle.mockResolvedValue({
      data: {
        return_invoice_xml_url: 'decisions/ret-1/123.xml',
        return_photos: [
          { storage_path: 'uid/box-0.jpg',  photo_type: 'box' },
          { storage_path: 'uid/item-0.jpg', photo_type: 'item' },
        ],
      },
      error: null,
    })

    const result = await deleteReturnAction('ret-1')

    expect(result).toEqual({ ok: true })
    expect(storageFrom).toHaveBeenCalledWith('box-photos')
    expect(storageFrom).toHaveBeenCalledWith('item-photos')
    expect(storageFrom).toHaveBeenCalledWith('invoice-xmls')
    expect(mockRemove).toHaveBeenCalledWith(['uid/box-0.jpg'])
    expect(mockRemove).toHaveBeenCalledWith(['uid/item-0.jpg'])
    expect(mockRemove).toHaveBeenCalledWith(['decisions/ret-1/123.xml'])
    expect(mockDeleteEq).toHaveBeenCalledWith('id', 'ret-1')
  })

  it('NÃO remove o XML/DANFE da NF original (ak/…), que é compartilhado por NF', async () => {
    mockSingle.mockResolvedValue({
      data: {
        return_invoice_xml_url: 'ak/35240112345678000195550010000123451123456780.xml',
        return_photos: [{ storage_path: 'uid/box-0.jpg', photo_type: 'box' }],
      },
      error: null,
    })

    const result = await deleteReturnAction('ret-2')

    expect(result).toEqual({ ok: true })
    expect(storageFrom).toHaveBeenCalledWith('box-photos')
    expect(storageFrom).not.toHaveBeenCalledWith('invoice-xmls')
    expect(mockDeleteEq).toHaveBeenCalledWith('id', 'ret-2')
  })

  it('apaga mesmo sem fotos nem XML de devolução', async () => {
    mockSingle.mockResolvedValue({
      data: { return_invoice_xml_url: null, return_photos: [] },
      error: null,
    })

    const result = await deleteReturnAction('ret-3')

    expect(result).toEqual({ ok: true })
    expect(mockRemove).not.toHaveBeenCalled()
    expect(mockDeleteEq).toHaveBeenCalledWith('id', 'ret-3')
  })

  it('retorna erro quando a busca da devolução falha', async () => {
    mockSingle.mockResolvedValue({ data: null, error: new Error('not found') })

    const result = await deleteReturnAction('ret-x')

    expect(result).toEqual({ error: 'not found' })
    expect(mockDeleteEq).not.toHaveBeenCalled()
  })

  it('retorna erro quando o delete falha', async () => {
    mockSingle.mockResolvedValue({
      data: { return_invoice_xml_url: null, return_photos: [] },
      error: null,
    })
    mockDeleteEq.mockResolvedValue({ error: new Error('delete failed') })

    const result = await deleteReturnAction('ret-4')

    expect(result).toEqual({ error: 'delete failed' })
  })

  it('revalida /admin/devolucoes após remoção bem-sucedida', async () => {
    mockSingle.mockResolvedValue({
      data: { return_invoice_xml_url: null, return_photos: [] },
      error: null,
    })
    const { revalidatePath } = await import('next/cache')

    await deleteReturnAction('ret-1')

    expect(revalidatePath).toHaveBeenCalledWith('/admin/devolucoes')
  })
})
