import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET } from '@/app/(public)/auth/callback/route'
import { ROLE_HOME } from '@/types'

// ── Supabase server client ───────────────────────────────────────────
const verifyOtp               = vi.fn()
const exchangeCodeForSession  = vi.fn()
const getUser                 = vi.fn()
const single                  = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({
    auth: { verifyOtp, exchangeCodeForSession, getUser },
    from: () => ({ select: () => ({ eq: () => ({ single }) }) }),
  })),
}))

const ORIGIN = 'http://localhost:3000'
function req(qs: string) {
  return { url: `${ORIGIN}/auth/callback${qs}` } as never
}
function location(res: Response) {
  return res.headers.get('location')
}

beforeEach(() => {
  vi.clearAllMocks()
  verifyOtp.mockResolvedValue({ error: null })
  exchangeCodeForSession.mockResolvedValue({ error: null })
  getUser.mockResolvedValue({ data: { user: { id: 'u-1' } } })
  single.mockResolvedValue({ data: { role: 'operator', terms_accepted_at: '2024-01-01' }, error: null })
})

describe('auth callback GET', () => {
  it('verifica token_hash e redireciona para a home do papel', async () => {
    const res = await GET(req('?token_hash=tok&type=magiclink'))

    expect(verifyOtp).toHaveBeenCalledWith({ type: 'magiclink', token_hash: 'tok' })
    expect(location(res)).toBe(`${ORIGIN}${ROLE_HOME.operator}`)
  })

  it('redireciona para primeiro-acesso quando termos não foram aceitos', async () => {
    single.mockResolvedValue({ data: { role: 'client', terms_accepted_at: null }, error: null })

    const res = await GET(req('?token_hash=tok&type=magiclink'))

    expect(location(res)).toBe(`${ORIGIN}/primeiro-acesso`)
  })

  it('redireciona para login com erro quando verifyOtp falha', async () => {
    verifyOtp.mockResolvedValue({ error: { message: 'expired' } })

    const res = await GET(req('?token_hash=bad&type=magiclink'))

    expect(location(res)).toBe(`${ORIGIN}/login?error=auth_callback_error`)
  })

  it('troca code por sessão no fluxo PKCE', async () => {
    single.mockResolvedValue({ data: { role: 'manager', terms_accepted_at: '2024-01-01' }, error: null })

    const res = await GET(req('?code=abc'))

    expect(exchangeCodeForSession).toHaveBeenCalledWith('abc')
    expect(location(res)).toBe(`${ORIGIN}${ROLE_HOME.manager}`)
  })

  it('redireciona para login com erro quando exchangeCodeForSession falha', async () => {
    exchangeCodeForSession.mockResolvedValue({ error: { message: 'invalid code' } })

    const res = await GET(req('?code=bad'))

    expect(location(res)).toBe(`${ORIGIN}/login?error=auth_callback_error`)
  })

  it('redireciona para login com erro quando faltam token e code', async () => {
    const res = await GET(req(''))

    expect(location(res)).toBe(`${ORIGIN}/login?error=auth_callback_error`)
    expect(verifyOtp).not.toHaveBeenCalled()
    expect(exchangeCodeForSession).not.toHaveBeenCalled()
  })

  it('redireciona para login com erro quando getUser não retorna usuário', async () => {
    getUser.mockResolvedValue({ data: { user: null } })

    const res = await GET(req('?token_hash=tok&type=magiclink'))

    expect(location(res)).toBe(`${ORIGIN}/login?error=auth_callback_error`)
  })

  it('redireciona para raiz quando não há perfil', async () => {
    single.mockResolvedValue({ data: null, error: null })

    const res = await GET(req('?token_hash=tok&type=magiclink'))

    expect(location(res)).toBe(`${ORIGIN}/`)
  })
})
