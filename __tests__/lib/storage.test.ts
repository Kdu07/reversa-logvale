import { describe, it, expect, vi, beforeEach } from 'vitest'
import { buildSignedUrlMap } from '@/lib/supabase/storage'

const createSignedUrls = vi.fn()
function fakeClient() {
  return { storage: { from: () => ({ createSignedUrls }) } } as never
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('buildSignedUrlMap', () => {
  it('retorna mapa vazio e não chama o storage quando não há paths', async () => {
    const map = await buildSignedUrlMap(fakeClient(), 'box-photos', [])

    expect(map.size).toBe(0)
    expect(createSignedUrls).not.toHaveBeenCalled()
  })

  it('mapeia path → signedUrl', async () => {
    createSignedUrls.mockResolvedValue({
      data: [
        { path: 'a.jpg', signedUrl: 'https://signed/a' },
        { path: 'b.jpg', signedUrl: 'https://signed/b' },
      ],
      error: null,
    })

    const map = await buildSignedUrlMap(fakeClient(), 'box-photos', ['a.jpg', 'b.jpg'])

    expect(createSignedUrls).toHaveBeenCalledWith(['a.jpg', 'b.jpg'], 3600)
    expect(map.get('a.jpg')).toBe('https://signed/a')
    expect(map.get('b.jpg')).toBe('https://signed/b')
  })

  it('ignora entradas sem path ou sem signedUrl', async () => {
    createSignedUrls.mockResolvedValue({
      data: [
        { path: 'ok.jpg',   signedUrl: 'https://signed/ok' },
        { path: null,       signedUrl: 'https://signed/x' },
        { path: 'bad.jpg',  signedUrl: null },
      ],
      error: null,
    })

    const map = await buildSignedUrlMap(fakeClient(), 'item-photos', ['ok.jpg', 'bad.jpg'])

    expect(map.size).toBe(1)
    expect(map.get('ok.jpg')).toBe('https://signed/ok')
  })

  it('retorna mapa vazio quando o storage não retorna data', async () => {
    createSignedUrls.mockResolvedValue({ data: null, error: { message: 'fail' } })

    const map = await buildSignedUrlMap(fakeClient(), 'invoice-xmls', ['x.xml'])

    expect(map.size).toBe(0)
  })
})
