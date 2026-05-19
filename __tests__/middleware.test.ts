import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'
import { middleware } from '@/middleware'

vi.mock('@/lib/supabase/middleware', () => ({
  updateSession: vi.fn(),
}))

import { updateSession } from '@/lib/supabase/middleware'

function makeReq(path: string) {
  return new NextRequest(`http://localhost${path}`)
}

function mockUnauthenticated() {
  vi.mocked(updateSession).mockResolvedValue({
    user:     null,
    response: NextResponse.next(),
  } as never)
}

function mockUser(meta: Record<string, unknown>) {
  const mockSupabase = {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq:     vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    }),
  }
  vi.mocked(updateSession).mockResolvedValue({
    supabase: mockSupabase,
    user:     { id: 'u-1', app_metadata: meta },
    response: NextResponse.next(),
  } as never)
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ─────────────────────────────────────────────────────────────────────
describe('middleware — bypass de internos do Next.js', () => {
  it('passa rotas /_next/ sem chamar updateSession', async () => {
    const res = await middleware(makeReq('/_next/static/chunk.js'))

    expect(updateSession).not.toHaveBeenCalled()
    expect(res.status).toBe(200)
  })

  it('passa arquivos com extensão sem chamar updateSession', async () => {
    const res = await middleware(makeReq('/favicon.ico'))

    expect(updateSession).not.toHaveBeenCalled()
  })
})

// ─────────────────────────────────────────────────────────────────────
describe('middleware — rotas públicas', () => {
  it('permite acesso a /login sem autenticação', async () => {
    mockUnauthenticated()
    const res = await middleware(makeReq('/login'))
    expect(res.headers.get('location')).toBeNull()
  })

  it('permite acesso a /privacidade sem autenticação', async () => {
    mockUnauthenticated()
    const res = await middleware(makeReq('/privacidade'))
    expect(res.headers.get('location')).toBeNull()
  })
})

// ─────────────────────────────────────────────────────────────────────
describe('middleware — usuário não autenticado', () => {
  it('redireciona /cliente para /login quando não autenticado', async () => {
    mockUnauthenticated()
    const res = await middleware(makeReq('/cliente'))
    expect(res.headers.get('location')).toContain('/login')
  })

  it('redireciona /operador para /login quando não autenticado', async () => {
    mockUnauthenticated()
    const res = await middleware(makeReq('/operador'))
    expect(res.headers.get('location')).toContain('/login')
  })

  it('redireciona /admin para /login quando não autenticado', async () => {
    mockUnauthenticated()
    const res = await middleware(makeReq('/admin'))
    expect(res.headers.get('location')).toContain('/login')
  })
})

// ─────────────────────────────────────────────────────────────────────
describe('middleware — claims ausentes ou usuário inativo', () => {
  it('redireciona para /api/auth/signout quando claims não estão no JWT (hook não propagado)', async () => {
    mockUser({}) // sem role → supabase retorna data:null → signout
    const res = await middleware(makeReq('/cliente'))
    expect(res.headers.get('location')).toContain('/api/auth/signout')
  })

  it('redireciona para /api/auth/signout quando active=false', async () => {
    mockUser({ role: 'client', active: false, terms_accepted_at: '2024-01-01' })
    const res = await middleware(makeReq('/cliente'))
    expect(res.headers.get('location')).toContain('/api/auth/signout')
  })
})

// ─────────────────────────────────────────────────────────────────────
describe('middleware — redirect após login', () => {
  it('redireciona manager de /login para /admin quando termos aceitos', async () => {
    mockUser({ role: 'manager', active: true, terms_accepted_at: '2024-01-01' })
    const res = await middleware(makeReq('/login'))
    expect(res.headers.get('location')).toContain('/admin')
  })

  it('redireciona operator de /login para /operador quando termos aceitos', async () => {
    mockUser({ role: 'operator', active: true, terms_accepted_at: '2024-01-01' })
    const res = await middleware(makeReq('/login'))
    expect(res.headers.get('location')).toContain('/operador')
  })

  it('redireciona client de /login para /cliente quando termos aceitos', async () => {
    mockUser({ role: 'client', active: true, terms_accepted_at: '2024-01-01' })
    const res = await middleware(makeReq('/login'))
    expect(res.headers.get('location')).toContain('/cliente')
  })

  it('redireciona qualquer role de /login para /primeiro-acesso quando termos não aceitos', async () => {
    mockUser({ role: 'operator', active: true, terms_accepted_at: null })
    const res = await middleware(makeReq('/login'))
    expect(res.headers.get('location')).toContain('/primeiro-acesso')
  })
})

// ─────────────────────────────────────────────────────────────────────
describe('middleware — enforcement de termos', () => {
  it('redireciona para /aceite-termos quando termos não aceitos em rota protegida', async () => {
    mockUser({ role: 'client', active: true, terms_accepted_at: null })
    const res = await middleware(makeReq('/cliente'))
    expect(res.headers.get('location')).toContain('/aceite-termos')
  })

  it('permite acesso a /aceite-termos mesmo sem termos aceitos', async () => {
    mockUser({ role: 'client', active: true, terms_accepted_at: null })
    const res = await middleware(makeReq('/aceite-termos'))
    expect(res.headers.get('location')).toBeNull()
  })

  it('permite acesso a /primeiro-acesso mesmo sem termos aceitos', async () => {
    mockUser({ role: 'operator', active: true, terms_accepted_at: null })
    const res = await middleware(makeReq('/primeiro-acesso'))
    expect(res.headers.get('location')).toBeNull()
  })
})

// ─────────────────────────────────────────────────────────────────────
describe('middleware — controle de acesso por role (cross-role)', () => {
  it('redireciona operator tentando acessar /cliente para /operador', async () => {
    mockUser({ role: 'operator', active: true, terms_accepted_at: '2024-01-01' })
    const res = await middleware(makeReq('/cliente'))
    expect(res.headers.get('location')).toContain('/operador')
  })

  it('redireciona client tentando acessar /operador para /cliente', async () => {
    mockUser({ role: 'client', active: true, terms_accepted_at: '2024-01-01' })
    const res = await middleware(makeReq('/operador'))
    expect(res.headers.get('location')).toContain('/cliente')
  })

  it('manager pode acessar qualquer rota (inclui /cliente, /operador)', async () => {
    mockUser({ role: 'manager', active: true, terms_accepted_at: '2024-01-01' })
    const res = await middleware(makeReq('/cliente'))
    // manager acessa tudo, não deve redirecionar
    expect(res.headers.get('location')).toBeNull()
  })

  it('operator acessa /operador normalmente', async () => {
    mockUser({ role: 'operator', active: true, terms_accepted_at: '2024-01-01' })
    const res = await middleware(makeReq('/operador'))
    expect(res.headers.get('location')).toBeNull()
  })
})
