import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  lookupInvoice,
  fetchInvoiceXml,
  fetchInvoicePdf,
  persistInvoiceFiles,
  parseFinalCustomerName,
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
    // NFEio desativada => sem arquivos persistidos (NULL, nunca string vazia)
    expect(result.xmlStoragePath).toBeNull()
    expect(result.pdfStoragePath).toBeNull()
    expect(result.xmlFetched).toBe(false)
    expect(result.pdfFetched).toBe(false)
    expect(result.invoiceFetchReason).toBe('disabled')
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
    expect(result.xmlFetched).toBe(true)
    expect(result.pdfFetched).toBe(true)
    expect(result.invoiceFetchReason).toBeNull()
  })

  it('não bloqueia o recebimento quando a NFEio falha (paths NULL + motivo)', async () => {
    env.nfeioEnabled = true
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 404 })))

    const result = await lookupInvoice(ACCESS_KEY)

    expect(result.emitterCnpj).toBe('12345678000195')
    expect(result.xmlStoragePath).toBeNull()
    expect(result.pdfStoragePath).toBeNull()
    expect(result.xmlFetched).toBe(false)
    expect(result.invoiceFetchReason).toBe('not_found')
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
  it('retorna nulls + motivo disabled quando desativada (sem upload)', async () => {
    env.nfeioEnabled = false
    const result = await persistInvoiceFiles(ACCESS_KEY)
    expect(result).toEqual({
      xmlPath: null, pdfPath: null, finalCustomerName: null,
      xmlReason: 'disabled', pdfReason: 'disabled',
    })
    expect(uploadMock).not.toHaveBeenCalled()
  })

  it('faz upload e devolve os paths (sem motivo) quando XML+PDF chegam', async () => {
    env.nfeioEnabled = true
    vi.stubGlobal('fetch', vi.fn(async (url: string) =>
      url.endsWith('.xml')
        ? new Response('<nfeProc/>', { status: 200 })
        : new Response(new Uint8Array([1]), { status: 200 }),
    ))

    const result = await persistInvoiceFiles(ACCESS_KEY)

    expect(result).toEqual({
      xmlPath: `ak/${ACCESS_KEY}.xml`, pdfPath: `ak/${ACCESS_KEY}.pdf`,
      finalCustomerName: null, xmlReason: null, pdfReason: null,
    })
    expect(uploadMock).toHaveBeenCalledWith(
      `ak/${ACCESS_KEY}.xml`, '<nfeProc/>', expect.objectContaining({ upsert: true }),
    )
  })

  it('propaga o motivo (not_found) sem path quando a NFEio responde 404', async () => {
    env.nfeioEnabled = true
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 404 })))

    const result = await persistInvoiceFiles(ACCESS_KEY)

    expect(result).toEqual({
      xmlPath: null, pdfPath: null, finalCustomerName: null,
      xmlReason: 'not_found', pdfReason: 'not_found',
    })
    expect(uploadMock).not.toHaveBeenCalled()
  })

  it('extrai o nome do cliente final do XML ao persistir', async () => {
    env.nfeioEnabled = true
    const xml =
      '<nfeProc><NFe><infNFe>' +
      '<emit><xNome>DEPOSITANTE LTDA</xNome></emit>' +
      '<dest><xNome>CLIENTE FINAL LTDA</xNome></dest>' +
      '</infNFe></NFe></nfeProc>'
    vi.stubGlobal('fetch', vi.fn(async (url: string) =>
      url.endsWith('.xml')
        ? new Response(xml, { status: 200 })
        : new Response(new Uint8Array([1]), { status: 200 }),
    ))

    const result = await persistInvoiceFiles(ACCESS_KEY)

    expect(result.finalCustomerName).toBe('CLIENTE FINAL LTDA')
  })
})

describe('parseFinalCustomerName', () => {
  it('extrai o xNome do bloco <dest>, ignorando o do <emit>', () => {
    const xml =
      '<infNFe>' +
      '<emit><CNPJ>12345678000195</CNPJ><xNome>DEPOSITANTE LTDA</xNome></emit>' +
      '<dest><CNPJ>98765432000110</CNPJ><xNome>CLIENTE FINAL LTDA</xNome></dest>' +
      '</infNFe>'
    expect(parseFinalCustomerName(xml)).toBe('CLIENTE FINAL LTDA')
  })

  it('decodifica entidades XML no nome', () => {
    expect(parseFinalCustomerName('<dest><xNome>JOÃO &amp; MARIA &lt;ME&gt;</xNome></dest>'))
      .toBe('JOÃO & MARIA <ME>')
  })

  it('retorna null quando não há bloco <dest>', () => {
    expect(parseFinalCustomerName('<emit><xNome>SÓ EMITENTE</xNome></emit>')).toBeNull()
  })

  it('retorna null quando o <dest> não tem xNome', () => {
    expect(parseFinalCustomerName('<dest><CNPJ>1</CNPJ></dest>')).toBeNull()
  })
})
