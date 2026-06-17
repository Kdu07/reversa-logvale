import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getXmlDownloadUrlAction } from '@/lib/actions/xml-download'

// ── auth ─────────────────────────────────────────────────────────────
const getCurrentUserOrNull = vi.fn()
vi.mock('@/lib/supabase/get-current-user', () => ({
  getCurrentUserOrNull: () => getCurrentUserOrNull(),
}))

// ── Supabase server client (storage) ─────────────────────────────────
const createSignedUrl = vi.fn()
const storageFrom     = vi.fn(() => ({ createSignedUrl }))
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({ storage: { from: storageFrom } })),
}))

beforeEach(() => {
  vi.clearAllMocks()
  getCurrentUserOrNull.mockResolvedValue({ id: 'u-1' })
  createSignedUrl.mockResolvedValue({
    data: { signedUrl: 'https://signed/url?download=RV1-nf-devolucao.xml' },
    error: null,
  })
})

describe('getXmlDownloadUrlAction', () => {
  it('assina no bucket invoice-xmls com a opção download e o filename', async () => {
    const result = await getXmlDownloadUrlAction('decisions/r-1/123.xml', 'RV1-nf-devolucao.xml')

    expect(result).toBe('https://signed/url?download=RV1-nf-devolucao.xml')
    expect(storageFrom).toHaveBeenCalledWith('invoice-xmls')
    expect(createSignedUrl).toHaveBeenCalledWith(
      'decisions/r-1/123.xml',
      3600,
      { download: 'RV1-nf-devolucao.xml' },
    )
  })

  it('retorna null e não chama o storage quando o path é vazio', async () => {
    const result = await getXmlDownloadUrlAction('', 'x.xml')

    expect(result).toBeNull()
    expect(createSignedUrl).not.toHaveBeenCalled()
  })

  it('retorna null e não chama o storage quando não há usuário autenticado', async () => {
    getCurrentUserOrNull.mockResolvedValue(null)

    const result = await getXmlDownloadUrlAction('decisions/r-1/123.xml', 'x.xml')

    expect(result).toBeNull()
    expect(createSignedUrl).not.toHaveBeenCalled()
  })

  it('retorna null quando o storage falha', async () => {
    createSignedUrl.mockResolvedValue({ data: null, error: { message: 'not found' } })

    const result = await getXmlDownloadUrlAction('missing.xml', 'x.xml')

    expect(result).toBeNull()
  })
})
