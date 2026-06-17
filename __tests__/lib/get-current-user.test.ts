import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getCurrentUser, getCurrentUserOrNull } from '@/lib/supabase/get-current-user'
import { redirect } from 'next/navigation'

const getUser = vi.fn()
const single  = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({
    auth: { getUser },
    from: () => ({ select: () => ({ eq: () => ({ single }) }) }),
  })),
}))

beforeEach(() => {
  vi.clearAllMocks()
  getUser.mockResolvedValue({ data: { user: { id: 'u-1', email: 'user@test.com' } } })
  single.mockResolvedValue({ data: { id: 'u-1', role: 'operator', active: true }, error: null })
})

describe('getCurrentUser', () => {
  it('retorna o usuário autenticado com perfil', async () => {
    const user = await getCurrentUser()

    expect(user).toMatchObject({ id: 'u-1', email: 'user@test.com', profile: { role: 'operator' } })
    expect(redirect).not.toHaveBeenCalled()
  })

  it('redireciona para /login quando não há sessão', async () => {
    getUser.mockResolvedValue({ data: { user: null } })

    await getCurrentUser()

    expect(redirect).toHaveBeenCalledWith('/login')
  })
})

describe('getCurrentUserOrNull', () => {
  it('retorna null quando não há sessão (sem redirect)', async () => {
    getUser.mockResolvedValue({ data: { user: null } })

    const user = await getCurrentUserOrNull()

    expect(user).toBeNull()
    expect(redirect).not.toHaveBeenCalled()
  })

  it('retorna null quando o perfil não existe', async () => {
    single.mockResolvedValue({ data: null, error: null })

    const user = await getCurrentUserOrNull()

    expect(user).toBeNull()
  })
})
