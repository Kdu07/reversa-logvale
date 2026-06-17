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

const fetchInvoiceXml = vi.fn()
vi.mock('@/lib/integrations/webmania', () => ({
  fetchInvoiceXml: (k: string) => fetchInvoiceXml(k),
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
const uploadMock = vi.fn().mockResolvedValue({ error: null })
const updateIs   = vi.fn().mockResolvedValue({ error: null })
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => ({
    from: () => ({
      select: () => ({
        eq: () => ({ is: () => Promise.resolve({ data: pendingRows, error: null }) }),
      }),
      update: () => ({ eq: () => ({ eq: () => ({ is: updateIs }) }) }),
    }),
    storage: { from: () => ({ upload: uploadMock }) },
  })),
}))

beforeEach(() => {
  vi.clearAllMocks()
  isSuperUser.mockReturnValue(true)
  countResult.count = 0
  countResult.error = null
  pendingRows = []
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
    expect(fetchInvoiceXml).not.toHaveBeenCalled()
  })

  it('retorna mensagem de vazio quando não há NF pendente', async () => {
    pendingRows = []
    const result = await retryMissingInvoiceXmlAction()
    expect(result).toMatchObject({ pending: 0, fetched: 0, notImplemented: false })
    expect(fetchInvoiceXml).not.toHaveBeenCalled()
  })

  it('aborta sem upload/update quando a API ainda não está implementada', async () => {
    pendingRows = [{ access_key: '111' }, { access_key: '222' }, { access_key: '111' }]
    fetchInvoiceXml.mockResolvedValue({ ok: false, reason: 'not_implemented', message: 'x' })

    const result = await retryMissingInvoiceXmlAction()

    expect(result).toMatchObject({ notImplemented: true, fetched: 0, failed: 0, pending: 2 })
    // chaves deduplicadas (111, 222) → mas aborta na primeira chamada
    expect(fetchInvoiceXml).toHaveBeenCalledTimes(1)
    expect(uploadMock).not.toHaveBeenCalled()
    expect(updateIs).not.toHaveBeenCalled()
  })

  it('faz upload e vincula o XML quando a busca tem sucesso', async () => {
    pendingRows = [{ access_key: '111' }]
    fetchInvoiceXml.mockResolvedValue({ ok: true, xml: '<nfe/>' })

    const result = await retryMissingInvoiceXmlAction()

    expect(result).toMatchObject({ fetched: 1, failed: 0, notImplemented: false })
    expect(uploadMock).toHaveBeenCalledWith('111.xml', '<nfe/>', expect.objectContaining({ upsert: true }))
    expect(updateIs).toHaveBeenCalled()
  })
})
