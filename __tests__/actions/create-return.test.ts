import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createReturnAction } from '@/app/(operator)/operador/recebimento/actions'

const mockSingle  = vi.fn()
const mockSelect  = vi.fn().mockReturnValue({ single: mockSingle })
const mockInsert  = vi.fn()
const mockFrom    = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({ from: mockFrom })),
}))

vi.mock('@/lib/supabase/get-current-user', () => ({
  getCurrentUser: vi.fn(),
}))

vi.mock('@/lib/integrations/nfeio', () => ({
  lookupInvoice: vi.fn(),
}))

import { getCurrentUser } from '@/lib/supabase/get-current-user'

function mockOperator() {
  vi.mocked(getCurrentUser).mockResolvedValue({
    id:      'op-1',
    email:   'op@test.com',
    profile: { id: 'op-1', role: 'operator', active: true, full_name: 'Op', phone: null, terms_accepted_at: null, created_at: '' },
  } as never)
}

const BASE_PAYLOAD = {
  identifierType:    'access_key' as const,
  accessKey:         '12345678901234567890123456789012345678901234',
  postalCode:        null,
  illegibleToken:    null,
  rv:                'RV-001',
  itemCount:         3,
  depositorId:       'dep-1',
  invoiceXmlPath:    null,
  invoicePdfPath:    null,
  finalCustomerName: null,
  boxPhotosPaths:    ['box/1.jpg'],
  itemPhotosPaths:   ['item/1.jpg'],
}

beforeEach(() => {
  vi.clearAllMocks()
  mockSingle.mockResolvedValue({ data: { id: 'ret-1' }, error: null })
  mockInsert.mockReturnValue({ select: mockSelect })

  mockFrom.mockImplementation((table: string) => {
    if (table === 'returns')       return { insert: mockInsert }
    if (table === 'return_photos') return { insert: vi.fn().mockResolvedValue({ error: null }) }
    return {}
  })
})

describe('createReturnAction', () => {
  it('cria devolução e retorna returnId', async () => {
    mockOperator()

    const result = await createReturnAction(BASE_PAYLOAD)

    expect(result).toEqual({ returnId: 'ret-1' })
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({ rv: 'RV-001', received_by: 'op-1' }),
    )
  })

  it('persiste o nome do cliente final quando fornecido', async () => {
    mockOperator()

    await createReturnAction({ ...BASE_PAYLOAD, finalCustomerName: 'FULANO DE TAL' })

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({ final_customer_name: 'FULANO DE TAL' }),
    )
  })

  it('rejeita recebimento sem foto de caixa ou de item', async () => {
    mockOperator()

    const semCaixa = await createReturnAction({ ...BASE_PAYLOAD, boxPhotosPaths: [] })
    expect(semCaixa).toEqual({ error: 'É necessária ao menos 1 foto da caixa e 1 foto do item.' })

    const semItem = await createReturnAction({ ...BASE_PAYLOAD, itemPhotosPaths: [] })
    expect(semItem).toEqual({ error: 'É necessária ao menos 1 foto da caixa e 1 foto do item.' })

    expect(mockInsert).not.toHaveBeenCalled()
  })

  it('insere fotos quando fornecidas', async () => {
    mockOperator()
    const photoInsert = vi.fn().mockResolvedValue({ error: null })
    mockFrom.mockImplementation((table: string) => {
      if (table === 'returns')       return { insert: mockInsert }
      if (table === 'return_photos') return { insert: photoInsert }
      return {}
    })

    const result = await createReturnAction({
      ...BASE_PAYLOAD,
      boxPhotosPaths:  ['box/1.jpg', 'box/2.jpg'],
      itemPhotosPaths: ['item/1.jpg'],
    })

    expect(result).toEqual({ returnId: 'ret-1' })
    expect(photoInsert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ photo_type: 'box',  position: 0 }),
        expect.objectContaining({ photo_type: 'box',  position: 1 }),
        expect.objectContaining({ photo_type: 'item', position: 0 }),
      ]),
    )
  })

  it('retorna erro de acesso negado quando role não é operator', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({
      id: 'c-1',
      email: 'c@test.com',
      profile: { id: 'c-1', role: 'client', active: true, full_name: 'C', phone: null, terms_accepted_at: null, created_at: '' },
    } as never)

    const result = await createReturnAction(BASE_PAYLOAD)

    expect(result).toEqual({ error: 'Acesso negado' })
    expect(mockInsert).not.toHaveBeenCalled()
  })

  it('retorna erro quando insert de returns falha', async () => {
    mockOperator()
    mockSingle.mockResolvedValue({ data: null, error: { message: 'constraint violation' } })

    const result = await createReturnAction(BASE_PAYLOAD)

    expect(result).toEqual({ error: 'constraint violation' })
  })

  it('retorna erro quando insert de fotos falha', async () => {
    mockOperator()
    const photoInsert = vi.fn().mockResolvedValue({ error: { message: 'storage error' } })
    mockFrom.mockImplementation((table: string) => {
      if (table === 'returns')       return { insert: mockInsert }
      if (table === 'return_photos') return { insert: photoInsert }
      return {}
    })

    const result = await createReturnAction({
      ...BASE_PAYLOAD,
      boxPhotosPaths: ['box/1.jpg'],
    })

    expect(result).toEqual({ error: 'storage error' })
  })
})
