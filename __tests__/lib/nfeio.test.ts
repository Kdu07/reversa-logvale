import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  lookupInvoice,
  fetchInvoiceXml,
  fetchInvoicePdf,
  persistInvoiceFiles,
} from '@/lib/integrations/nfeio'

// env mockado e mutável — os campos nfeio* são lidos em tempo de chamada,
// então alternamos nfeioEnabled por teste. vi.hoisted evita o erro de
// "acesso antes da inicialização" no factory hoisteado do vi.mock.
const { env } = vi.hoisted(() => ({
  env: {
    supabaseUrl:            'https://test.supabase.co',
    supabaseServiceRoleKey: 'test-service-key',
    nfeioApiKey:            'test-api-key',
    nfeioBaseUrl:           'https://nfe.api.nfe.io',
    nfeioEnabled:           false,
  },
}))
vi.mock('@/lib/env', () => ({ env }))

let depositorResult: { data: unknown; error: null } = { data: null, error: null }
const uploadMock = vi.fn().mockResolvedValue({ error: null })

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
  storage: { from: vi.fn(() => ({ upload: uploadMock })) },
}

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockClient),
}))

// Chave real: UF 35 · AAMM 2401 (jan/2024) · CNPJ 12345678000195 · mod 55 · série 001 · nNF 000012345
const ACCESS_KEY = '35240112345678000195550010000123451123456780'

beforeEach(() => {
  vi.clearAllMocks()
  depositorResult = { data: null, error: null }
  env.nfeioEnabled = false
  uploadMock.mockResolvedValue({ error: null })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('lookupInvoice (parsing local da chave)', () => {
  it('extrai CNPJ emitente, número e mês de emissão da chave', async () => {
    const result = await lookupInvoice(ACCESS_KEY)

    expect(result.accessKey).toBe(ACCESS_KEY)
    expect(result.emitterCnpj).toBe('12345678000195')
    expect(result.invoiceNumber).toBe('12345')
    expect(result.emittedAt).toBe('2024-01-01')
    // NFEio desativada => sem arquivos persistidos
    expect(result.xmlStoragePath).toBe('')
    expect(result.pdfStoragePath).toBe('')
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

  it('persiste XML+PDF e popula os paths quando a NFEio está ativa', async () => {
    env.nfeioEnabled = true
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url.endsWith('.xml')) return new Response('<nfeProc/>', { status: 200 })
      if (url.endsWith('.pdf')) return new Response(new Uint8Array([1, 2, 3]), { status: 200 })
      return new Response('', { status: 404 })
    }))

    const result = await lookupInvoice(ACCESS_KEY)

    expect(result.xmlStoragePath).toBe(`ak/${ACCESS_KEY}.xml`)
    expect(result.pdfStoragePath).toBe(`ak/${ACCESS_KEY}.pdf`)
  })

  it('não bloqueia o recebimento quando a NFEio falha (paths vazios)', async () => {
    env.nfeioEnabled = true
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 404 })))

    const result = await lookupInvoice(ACCESS_KEY)

    expect(result.emitterCnpj).toBe('12345678000195')
    expect(result.xmlStoragePath).toBe('')
    expect(result.pdfStoragePath).toBe('')
  })
})

describe('fetchInvoiceXml', () => {
  it('retorna disabled quando a integração está desligada', async () => {
    env.nfeioEnabled = false
    const result = await fetchInvoiceXml(ACCESS_KEY)
    expect(result).toMatchObject({ ok: false, reason: 'disabled' })
  })

  it('retorna o XML em caso de sucesso (HTTP 200)', async () => {
    env.nfeioEnabled = true
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<nfeProc/>', { status: 200 })))
    const result = await fetchInvoiceXml(ACCESS_KEY)
    expect(result).toEqual({ ok: true, xml: '<nfeProc/>' })
  })

  it('mapeia 404 para not_found', async () => {
    env.nfeioEnabled = true
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 404 })))
    const result = await fetchInvoiceXml(ACCESS_KEY)
    expect(result).toMatchObject({ ok: false, reason: 'not_found' })
  })

  it('mapeia 401/403 para unauthorized', async () => {
    env.nfeioEnabled = true
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 403 })))
    const result = await fetchInvoiceXml(ACCESS_KEY)
    expect(result).toMatchObject({ ok: false, reason: 'unauthorized' })
  })

  it('retorna error quando o fetch lança', async () => {
    env.nfeioEnabled = true
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('network down') }))
    const result = await fetchInvoiceXml(ACCESS_KEY)
    expect(result).toMatchObject({ ok: false, reason: 'error' })
  })
})

describe('fetchInvoicePdf', () => {
  it('retorna o PDF como Uint8Array em caso de sucesso', async () => {
    env.nfeioEnabled = true
    vi.stubGlobal('fetch', vi.fn(async () => new Response(new Uint8Array([1, 2, 3]), { status: 200 })))
    const result = await fetchInvoicePdf(ACCESS_KEY)
    expect(result.ok).toBe(true)
    if (result.ok) expect(Array.from(result.pdf)).toEqual([1, 2, 3])
  })
})

describe('persistInvoiceFiles', () => {
  it('retorna nulls quando desativada (sem upload)', async () => {
    env.nfeioEnabled = false
    const result = await persistInvoiceFiles(ACCESS_KEY)
    expect(result).toEqual({ xmlPath: null, pdfPath: null })
    expect(uploadMock).not.toHaveBeenCalled()
  })

  it('faz upload e devolve os paths quando XML+PDF chegam', async () => {
    env.nfeioEnabled = true
    vi.stubGlobal('fetch', vi.fn(async (url: string) =>
      url.endsWith('.xml')
        ? new Response('<nfeProc/>', { status: 200 })
        : new Response(new Uint8Array([1]), { status: 200 }),
    ))

    const result = await persistInvoiceFiles(ACCESS_KEY)

    expect(result).toEqual({ xmlPath: `ak/${ACCESS_KEY}.xml`, pdfPath: `ak/${ACCESS_KEY}.pdf` })
    expect(uploadMock).toHaveBeenCalledWith(
      `ak/${ACCESS_KEY}.xml`, '<nfeProc/>', expect.objectContaining({ upsert: true }),
    )
  })
})
