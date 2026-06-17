import { describe, it, expect, vi, beforeEach } from 'vitest'
import JSZip from 'jszip'
import { exportUserDataAction } from '@/app/(manager)/admin/usuarios/actions'

// ── assertManager → getCurrentUser ───────────────────────────────────
const getCurrentUser = vi.fn()
vi.mock('@/lib/supabase/get-current-user', () => ({
  getCurrentUser: () => getCurrentUser(),
}))

// ── Supabase server client (profiles + returns) ──────────────────────
let profileResult: { data: unknown; error: unknown }
let returnsResult: { data: unknown; error: unknown }

function serverBuilder(table: string) {
  const b: Record<string, unknown> = {}
  const chain = () => b
  b.select = vi.fn(chain)
  b.eq     = vi.fn(chain)
  // profiles is read via .single(); returns is awaited directly (thenable)
  b.single = vi.fn(() => Promise.resolve(profileResult))
  b.then   = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
    Promise.resolve(table === 'returns' ? returnsResult : { data: null, error: null }).then(resolve, reject)
  return b
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({ from: (t: string) => serverBuilder(t) })),
}))

// ── Supabase admin client (auth.admin.getUserById) ───────────────────
const mockGetUserById = vi.fn()
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => ({
    auth: { admin: { getUserById: mockGetUserById } },
  })),
}))

// resend/env are imported by the actions module but unused by this action
vi.mock('@/lib/integrations/resend', () => ({ sendAccountCreatedEmail: vi.fn() }))
vi.mock('@/lib/env', () => ({ env: { resendApiKey: 'k', appUrl: 'http://localhost:3000' } }))

function asManager() {
  getCurrentUser.mockResolvedValue({
    id: 'm-1', email: 'm@logvale.com',
    profile: { id: 'm-1', role: 'manager', active: true, full_name: 'M', phone: null, terms_accepted_at: '2024-01-01', created_at: '' },
  })
}

const USER_ID = 'abcd1234-0000-0000-0000-000000000000'

beforeEach(() => {
  vi.clearAllMocks()
  asManager()
  mockGetUserById.mockResolvedValue({
    data: { user: { email: 'cliente@test.com', last_sign_in_at: '2025-01-02T00:00:00Z' } },
    error: null,
  })
  profileResult = {
    data: { full_name: 'Cliente Teste', phone: '11999999999', role: 'client', created_at: '2024-01-01', terms_accepted_at: '2024-01-05' },
    error: null,
  }
  returnsResult = {
    data: [{ rv: 'RV-1', received_at: '2025-01-01', status: 'decided', decision: 'discard', decided_at: '2025-01-02', decided_by_type: 'client', processed_at: null }],
    error: null,
  }
})

describe('exportUserDataAction (LGPD)', () => {
  it('gera um ZIP com perfil, devoluções e consentimento', async () => {
    const result = await exportUserDataAction(USER_ID)

    expect(result).not.toHaveProperty('error')
    const ok = result as { base64: string; filename: string }
    expect(ok.base64.length).toBeGreaterThan(0)
    expect(ok.filename).toBe(`export_${USER_ID.slice(0, 8)}_${new Date().toISOString().slice(0, 10)}.zip`)

    // O ZIP deve conter os 3 arquivos exigidos pela LGPD
    const zip   = await JSZip.loadAsync(ok.base64, { base64: true })
    const names = Object.keys(zip.files).sort()
    expect(names).toEqual(['consentimento.json', 'devolucoes.json', 'perfil.json'])

    const perfil = JSON.parse(await zip.file('perfil.json')!.async('string'))
    expect(perfil).toMatchObject({ full_name: 'Cliente Teste', email: 'cliente@test.com', role: 'client' })

    const consent = JSON.parse(await zip.file('consentimento.json')!.async('string'))
    expect(consent.terms_accepted_at).toBe('2024-01-05')
    expect(consent.exported_at).toBeTruthy()
  })

  it('nega acesso quando o usuário não é manager', async () => {
    getCurrentUser.mockResolvedValue({
      id: 'op-1', email: 'op@test.com',
      profile: { id: 'op-1', role: 'operator', active: true, full_name: 'Op', phone: null, terms_accepted_at: null, created_at: '' },
    })

    const result = await exportUserDataAction(USER_ID)

    expect(result).toEqual({ error: 'Acesso negado' })
    expect(mockGetUserById).not.toHaveBeenCalled()
  })

  it('propaga erro quando a busca do usuário no auth falha', async () => {
    mockGetUserById.mockResolvedValue({ data: { user: null }, error: new Error('auth lookup failed') })

    const result = await exportUserDataAction(USER_ID)

    expect(result).toEqual({ error: 'auth lookup failed' })
  })

  it('propaga erro quando a busca do perfil falha', async () => {
    profileResult = { data: null, error: new Error('profile not found') }

    const result = await exportUserDataAction(USER_ID)

    expect(result).toEqual({ error: 'profile not found' })
  })

  it('propaga erro quando a busca das devoluções falha', async () => {
    returnsResult = { data: null, error: new Error('returns query failed') }

    const result = await exportUserDataAction(USER_ID)

    expect(result).toEqual({ error: 'returns query failed' })
  })
})
