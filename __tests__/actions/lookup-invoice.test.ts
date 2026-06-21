import { describe, it, expect, vi, beforeEach } from 'vitest'
import { lookupInvoiceAction } from '@/app/(operator)/operador/recebimento/actions'

vi.mock('@/lib/integrations/nfeio', () => ({
  lookupInvoice: vi.fn(),
}))

// lookupInvoiceAction não usa getCurrentUser, sem mock necessário

import { lookupInvoice } from '@/lib/integrations/nfeio'

const VALID_KEY = '12345678901234567890123456789012345678901234' // 44 dígitos

const MOCK_INVOICE_DATA = {
  accessKey:      VALID_KEY,
  emitterCnpj:    '12345678000199',
  invoiceNumber:  '000001',
  emittedAt:      '2024-01-15',
  xmlStoragePath: 'ak/abc.xml',
  pdfStoragePath: 'ak/abc.pdf',
  depositorId:    'dep-1',
  depositorName:  'Empresa Teste Ltda',
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('lookupInvoiceAction', () => {
  it('retorna erro para chave com menos de 44 dígitos', async () => {
    const result = await lookupInvoiceAction('1234567890')

    expect(result).toHaveProperty('error')
    expect((result as { error: string }).error).toContain('44')
    expect(lookupInvoice).not.toHaveBeenCalled()
  })

  it('retorna erro para chave com letras (não numérica)', async () => {
    const chaveComLetras = 'ABCD5678901234567890123456789012345678901234'

    const result = await lookupInvoiceAction(chaveComLetras)

    expect(result).toHaveProperty('error')
    expect(lookupInvoice).not.toHaveBeenCalled()
  })

  it('retorna erro para chave com 45 dígitos (acima do limite)', async () => {
    const chaveLonga = '123456789012345678901234567890123456789012345' // 45

    const result = await lookupInvoiceAction(chaveLonga)

    expect(result).toHaveProperty('error')
    expect(lookupInvoice).not.toHaveBeenCalled()
  })

  it('delega para lookupInvoice e retorna {data} com chave válida', async () => {
    vi.mocked(lookupInvoice).mockResolvedValue(MOCK_INVOICE_DATA as never)

    const result = await lookupInvoiceAction(VALID_KEY)

    expect(lookupInvoice).toHaveBeenCalledWith(VALID_KEY)
    expect(result).toEqual({ data: MOCK_INVOICE_DATA })
  })

  it('retorna {error} quando lookupInvoice lança exceção', async () => {
    vi.mocked(lookupInvoice).mockRejectedValue(new Error('NFEio indisponível'))

    const result = await lookupInvoiceAction(VALID_KEY)

    expect(result).toEqual({ error: 'NFEio indisponível' })
  })

  it('retorna mensagem genérica para erros não-Error', async () => {
    vi.mocked(lookupInvoice).mockRejectedValue('erro estranho')

    const result = await lookupInvoiceAction(VALID_KEY)

    expect(result).toHaveProperty('error')
  })
})
