import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET } from '@/app/api/auth/signout/route'

const signOut = vi.fn()
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({ auth: { signOut } })),
}))

beforeEach(() => {
  vi.clearAllMocks()
  signOut.mockResolvedValue({ error: null })
})

describe('signout GET', () => {
  it('encerra a sessão e redireciona para /login', async () => {
    const res = await GET({ url: 'http://localhost:3000/api/auth/signout' } as never)

    expect(signOut).toHaveBeenCalled()
    expect(res.headers.get('location')).toBe('http://localhost:3000/login')
  })
})
