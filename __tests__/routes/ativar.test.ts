import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET } from '@/app/(public)/ativar/route'

// ── activation-token helper ──────────────────────────────────────────
const consumeActivationToken = vi.fn()
vi.mock('@/lib/auth/activation-token', () => ({
  consumeActivationToken: (s: string) => consumeActivationToken(s),
}))

// ── Supabase admin client ────────────────────────────────────────────
const getUserById   = vi.fn()
const generateLink  = vi.fn()
const adminSingle   = vi.fn()
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => ({
    from: () => ({ select: () => ({ eq: () => ({ single: adminSingle }) }) }),
    auth: { admin: { getUserById, generateLink } },
  })),
}))

// ── Supabase server client ───────────────────────────────────────────
const verifyOtp = vi.fn()
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({ auth: { verifyOtp } })),
}))

const ORIGIN = 'http://localhost:3000'
function req(qs: string) {
  return { url: `${ORIGIN}/ativar${qs}` } as never
}
function location(res: Response) {
  return res.headers.get('location')
}

beforeEach(() => {
  vi.clearAllMocks()
  consumeActivationToken.mockResolvedValue('user-1')
  adminSingle.mockResolvedValue({ data: { terms_accepted_at: null }, error: null })
  getUserById.mockResolvedValue({ data: { user: { email: 'user@test.com' } }, error: null })
  generateLink.mockResolvedValue({ data: { properties: { hashed_token: 'tok-1' } }, error: null })
  verifyOtp.mockResolvedValue({ error: null })
})

describe('ativar GET', () => {
  it('token válido + conta não ativada ⇒ cria sessão e vai para /primeiro-acesso', async () => {
    const res = await GET(req('?token=seg'))

    expect(consumeActivationToken).toHaveBeenCalledWith('seg')
    expect(verifyOtp).toHaveBeenCalledWith({ type: 'magiclink', token_hash: 'tok-1' })
    expect(location(res)).toBe(`${ORIGIN}/primeiro-acesso`)
  })

  it('token inválido/usado ⇒ erro no login', async () => {
    consumeActivationToken.mockResolvedValue(null)

    const res = await GET(req('?token=ruim'))

    expect(location(res)).toBe(`${ORIGIN}/login?error=auth_callback_error`)
    expect(verifyOtp).not.toHaveBeenCalled()
  })

  it('conta já ativada ⇒ manda para /login sem criar sessão', async () => {
    adminSingle.mockResolvedValue({ data: { terms_accepted_at: '2025-01-01' }, error: null })

    const res = await GET(req('?token=seg'))

    expect(location(res)).toBe(`${ORIGIN}/login`)
    expect(verifyOtp).not.toHaveBeenCalled()
  })

  it('erro no verifyOtp ⇒ erro no login', async () => {
    verifyOtp.mockResolvedValue({ error: { message: 'bad' } })

    const res = await GET(req('?token=seg'))

    expect(location(res)).toBe(`${ORIGIN}/login?error=auth_callback_error`)
  })

  it('sem token ⇒ erro no login', async () => {
    consumeActivationToken.mockResolvedValue(null)

    const res = await GET(req(''))

    expect(location(res)).toBe(`${ORIGIN}/login?error=auth_callback_error`)
  })
})
