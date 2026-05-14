import { describe, it, expect, vi, beforeEach } from 'vitest'
import { lookupInvoice } from '@/lib/integrations/webmania'

vi.mock('@/lib/env', () => ({
  env: {
    supabaseUrl:            'https://test.supabase.co',
    supabaseServiceRoleKey: 'test-service-key',
    webmaniaToken:          'test-token',
    webmaniaSecret:         'test-secret',
    webmaniaBaseUrl:        'https://api.webmaniabr.com',
  },
}))

const mockUpload    = vi.fn().mockResolvedValue({ error: null })
const mockUpsert    = vi.fn().mockResolvedValue({ error: null })
const mockStorageFrom = vi.fn().mockReturnValue({ upload: mockUpload })

let cacheResult:     { data: unknown; error: null } = { data: null, error: null }
let depositorResult: { data: unknown; error: null } = { data: null, error: null }

const mockClient = {
  from: vi.fn((table: string) => {
    if (table === 'invoice_cache') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue(cacheResult),
          }),
        }),
        upsert: mockUpsert,
      }
    }
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
  storage: { from: mockStorageFrom },
}

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockClient),
}))

const ACCESS_KEY = '12345678901234567890123456789012345678901234'

const WEBMANIA_SUCCESS = {
  nfe: {
    chNFe: ACCESS_KEY,
    emit:  { CNPJ: '12345678000100' },
    ide:   { nNF: '12345', dhEmi: '2024-01-01T00:00:00' },
  },
  xml: '<nfeProc>...</nfeProc>',
}

beforeEach(() => {
  vi.clearAllMocks()
  cacheResult     = { data: null,  error: null }
  depositorResult = { data: null,  error: null }
  mockUpload.mockResolvedValue({ error: null })
  mockUpsert.mockResolvedValue({ error: null })
  global.fetch = vi.fn()
})

describe('lookupInvoice', () => {
  it('retorna do cache sem chamar fetch', async () => {
    cacheResult = {
      data: {
        access_key:     ACCESS_KEY,
        emitter_cnpj:   '12345678000100',
        invoice_number: '12345',
        emitted_at:     '2024-01-01T00:00:00',
        xml_url:        `${ACCESS_KEY}.xml`,
      },
      error: null,
    }
    depositorResult = { data: { id: 'dep-1' }, error: null }

    const result = await lookupInvoice(ACCESS_KEY)

    expect(global.fetch).not.toHaveBeenCalled()
    expect(result.accessKey).toBe(ACCESS_KEY)
    expect(result.emitterCnpj).toBe('12345678000100')
    expect(result.depositorId).toBe('dep-1')
  })

  it('busca na API quando não há cache', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok:   true,
      json: vi.fn().mockResolvedValue(WEBMANIA_SUCCESS),
    } as unknown as Response)
    depositorResult = { data: { id: 'dep-2' }, error: null }

    const result = await lookupInvoice(ACCESS_KEY)

    expect(global.fetch).toHaveBeenCalledTimes(1)
    expect(result.emitterCnpj).toBe('12345678000100')
    expect(result.xmlStoragePath).toBe(`${ACCESS_KEY}.xml`)
    expect(mockUpload).toHaveBeenCalledWith(
      `${ACCESS_KEY}.xml`,
      expect.any(Blob),
      expect.any(Object),
    )
    expect(mockUpsert).toHaveBeenCalled()
  })

  it('retorna depositorId null quando depositante não encontrado', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok:   true,
      json: vi.fn().mockResolvedValue(WEBMANIA_SUCCESS),
    } as unknown as Response)
    depositorResult = { data: null, error: null }

    const result = await lookupInvoice(ACCESS_KEY)

    expect(result.depositorId).toBeNull()
  })

  it('lança erro após 3 tentativas com falha na API', async () => {
    vi.mocked(global.fetch).mockRejectedValue(new Error('Network error'))

    await expect(lookupInvoice(ACCESS_KEY)).rejects.toThrow('Network error')
    expect(global.fetch).toHaveBeenCalledTimes(3)
  })

  it('lança erro quando resposta da Webmania não contém CNPJ do emitente', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok:   true,
      json: vi.fn().mockResolvedValue({ nfe: {}, xml: '' }),
    } as unknown as Response)

    await expect(lookupInvoice(ACCESS_KEY)).rejects.toThrow(
      'NF não encontrada ou resposta Webmania inválida',
    )
  })

  it('lança erro quando API retorna status HTTP de erro', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok:     false,
      status: 401,
      json:   vi.fn(),
    } as unknown as Response)

    await expect(lookupInvoice(ACCESS_KEY)).rejects.toThrow('Webmania retornou 401')
  })
})
