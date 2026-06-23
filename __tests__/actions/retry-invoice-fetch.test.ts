import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  getMissingInvoiceXmlCountAction,
  retryMissingInvoiceXmlAction,
} from '@/app/(manager)/admin/devolucoes/actions'

vi.mock('@/lib/supabase/get-current-user', () => ({
  getCurrentUser: vi.fn().mockResolvedValue({
    id: 's-1', email: 'super@logvale.com', profile: { role: 'manager' },
  }),
}))

const isSuperUser = vi.fn().mockReturnValue(true)
vi.mock('@/lib/auth/super', () => ({ isSuperUser: (u: unknown) => isSuperUser(u) }))

vi.mock('@/lib/supabase/storage', () => ({
  buildSignedUrlMap: vi.fn().mockResolvedValue(new Map()),
}))

// env mutável — alternamos nfeioEnabled por teste (vi.hoisted p/ o factory hoisteado)
const { env } = vi.hoisted(() => ({ env: { nfeioEnabled: true } }))
vi.mock('@/lib/env', () => ({ env }))

const persistInvoiceFiles = vi.fn()
vi.mock('@/lib/integrations/nfeio', () => ({
  persistInvoiceFiles: (k: string) => persistInvoiceFiles(k),
}))

// --- server client (count action) ---
const countResult = { count: 0, error: null as unknown }
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({
    from: () => ({
      select: () => ({
        eq: () => ({ is: () => Promise.resolve(countResult) }),
      }),
    }),
  })),
}))

// --- admin client (retry action) ---
let pendingRows: { access_key: string | null }[] = []
const updateIs = vi.fn().mockResolvedValue({ error: null })
const updateMock = vi.fn(() => ({ eq: () => ({ eq: () => ({ is: updateIs }) }) }))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => ({
    from: () => ({
      select: () => ({
        eq: () => ({ is: () => Promise.resolve({ data: pendingRows, error: null }) }),
      }),
      update: updateMock,
    }),
  })),
}))

beforeEach(() => {
  vi.clearAllMocks()
  isSuperUser.mockReturnValue(true)
  env.nfeioEnabled = true
  countResult.count = 0
  countResult.error = null
  pendingRows = []
  updateIs.mockResolvedValue({ error: null })
})

describe('getMissingInvoiceXmlCountAction', () => {
  it('nega acesso a quem não é super', async () => {
    isSuperUser.mockReturnValue(false)
    const result = await getMissingInvoiceXmlCountAction()
    expect(result).toEqual({ error: 'Acesso negado' })
  })

  it('retorna a contagem de NFs sem XML para super', async () => {
    countResult.count = 7
    const result = await getMissingInvoiceXmlCountAction()
    expect(result).toEqual({ count: 7 })
  })
})

describe('retryMissingInvoiceXmlAction', () => {
  it('nega acesso a quem não é super', async () => {
    isSuperUser.mockReturnValue(false)
    const result = await retryMissingInvoiceXmlAction()
    expect(result).toEqual({ error: 'Acesso negado' })
    expect(persistInvoiceFiles).not.toHaveBeenCalled()
  })

  it('retorna disabled quando a integração NFEio está desligada', async () => {
    env.nfeioEnabled = false
    const result = await retryMissingInvoiceXmlAction()
    expect(result).toMatchObject({ disabled: true, fetched: 0, failed: 0 })
    expect(persistInvoiceFiles).not.toHaveBeenCalled()
  })

  it('retorna mensagem de vazio quando não há NF pendente', async () => {
    pendingRows = []
    const result = await retryMissingInvoiceXmlAction()
    expect(result).toMatchObject({ pending: 0, fetched: 0, disabled: false })
    expect(persistInvoiceFiles).not.toHaveBeenCalled()
  })

  it('persiste XML+PDF e vincula as colunas quando a busca tem sucesso', async () => {
    pendingRows = [{ access_key: '111' }, { access_key: '222' }, { access_key: '111' }]
    persistInvoiceFiles.mockResolvedValue({ xmlPath: 'ak/x.xml', pdfPath: 'ak/x.pdf', finalCustomerName: 'CLIENTE X' })

    const result = await retryMissingInvoiceXmlAction()

    // chaves deduplicadas (111, 222)
    expect(result).toMatchObject({ fetched: 2, failed: 0, disabled: false, pending: 2 })
    expect(persistInvoiceFiles).toHaveBeenCalledTimes(2)
    expect(updateMock).toHaveBeenCalledWith({ invoice_xml_url: 'ak/x.xml', invoice_pdf_url: 'ak/x.pdf', final_customer_name: 'CLIENTE X' })
  })

  it('conta como falha quando o XML não é obtido', async () => {
    pendingRows = [{ access_key: '111' }]
    persistInvoiceFiles.mockResolvedValue({ xmlPath: null, pdfPath: null, finalCustomerName: null })

    const result = await retryMissingInvoiceXmlAction()

    expect(result).toMatchObject({ fetched: 0, failed: 1, disabled: false })
    expect(updateMock).not.toHaveBeenCalled()
  })
})
