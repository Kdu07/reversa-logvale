import { describe, it, expect, vi, beforeEach } from 'vitest'
import { lookupInvoice, fetchInvoiceXml } from '@/lib/integrations/webmania'

vi.mock('@/lib/env', () => ({
  env: {
    supabaseUrl:            'https://test.supabase.co',
    supabaseServiceRoleKey: 'test-service-key',
  },
}))

let depositorResult: { data: unknown; error: null } = { data: null, error: null }

const mockClient = {
  from: vi.fn((table: string) => {
    if (table === 'depositors') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue(depositorResult),
            }),
          }),
        }),
      }
    }
    return {}
  }),
}

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockClient),
}))

// Chave real: UF 35 · AAMM 2401 (jan/2024) · CNPJ 12345678000195 · mod 55 · série 001 · nNF 000012345
const ACCESS_KEY = '35240112345678000195550010000123451123456780'

beforeEach(() => {
  vi.clearAllMocks()
  depositorResult = { data: null, error: null }
})

describe('lookupInvoice (parsing local da chave)', () => {
  it('extrai CNPJ emitente, número e mês de emissão da chave', async () => {
    const result = await lookupInvoice(ACCESS_KEY)

    expect(result.accessKey).toBe(ACCESS_KEY)
    expect(result.emitterCnpj).toBe('12345678000195')
    expect(result.invoiceNumber).toBe('12345')
    expect(result.emittedAt).toBe('2024-01-01')
    expect(result.xmlStoragePath).toBe('')
  })

  it('vincula depositante quando o CNPJ emitente está cadastrado', async () => {
    depositorResult = { data: { id: 'dep-1', razao_social: 'Empresa Teste Ltda' }, error: null }

    const result = await lookupInvoice(ACCESS_KEY)

    expect(result.depositorId).toBe('dep-1')
    expect(result.depositorName).toBe('Empresa Teste Ltda')
  })

  it('retorna depositorId null quando o CNPJ não está cadastrado', async () => {
    depositorResult = { data: null, error: null }

    const result = await lookupInvoice(ACCESS_KEY)

    expect(result.depositorId).toBeNull()
    expect(result.depositorName).toBeNull()
  })

  it('lança erro para chave que não tem 44 dígitos', async () => {
    await expect(lookupInvoice('123')).rejects.toThrow('44')
  })
})

describe('fetchInvoiceXml (stub — API externa não implementada)', () => {
  it('retorna not_implemented enquanto a integração fiscal não existe', async () => {
    const result = await fetchInvoiceXml(ACCESS_KEY)
    expect(result).toEqual({
      ok: false,
      reason: 'not_implemented',
      message: expect.stringContaining('não implementada'),
    })
  })
})
