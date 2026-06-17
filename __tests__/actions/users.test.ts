import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  toggleActiveAction,
  createUserAction,
  anonymizeUserAction,
} from '@/app/(manager)/admin/usuarios/actions'

// assertManager usa getCurrentUser
vi.mock('@/lib/supabase/get-current-user', () => ({
  getCurrentUser: vi.fn().mockResolvedValue({
    id:      'm-1',
    email:   'm@logvale.com',
    profile: { id: 'm-1', role: 'manager', active: true, full_name: 'Manager', phone: null, terms_accepted_at: '2024-01-01', created_at: '' },
  }),
}))

vi.mock('@/lib/integrations/resend', () => ({
  sendAccountCreatedEmail: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/env', () => ({
  env: { resendApiKey: 'key-test', appUrl: 'http://localhost:3000' },
}))

// ── Supabase server client ────────────────────────────────────────────
const mockCountEq2     = vi.fn()
const mockCountEq1     = vi.fn().mockReturnValue({ eq: mockCountEq2 })
const mockCountSelect  = vi.fn().mockReturnValue({ eq: mockCountEq1 })
const mockUpdateEq     = vi.fn().mockResolvedValue({ error: null })
const mockUpdate       = vi.fn().mockReturnValue({ eq: mockUpdateEq })
const mockDeleteEq     = vi.fn().mockResolvedValue({ error: null })
const mockDelete       = vi.fn().mockReturnValue({ eq: mockDeleteEq })
const mockInsert       = vi.fn().mockResolvedValue({ error: null })
const mockFrom         = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({ from: mockFrom })),
}))

// ── Supabase admin client ─────────────────────────────────────────────
const mockCreateUser     = vi.fn()
const mockGenerateLink   = vi.fn()
const mockUpdateUserById = vi.fn()

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => ({
    auth: {
      admin: {
        createUser:     mockCreateUser,
        generateLink:   mockGenerateLink,
        updateUserById: mockUpdateUserById,
      },
    },
  })),
}))

beforeEach(() => {
  vi.clearAllMocks()

  // Default: supabase server client
  mockCountEq2.mockResolvedValue({ count: 0, error: null })
  mockUpdateEq.mockResolvedValue({ error: null })
  mockDeleteEq.mockResolvedValue({ error: null })
  mockInsert.mockResolvedValue({ error: null })

  mockFrom.mockImplementation((table: string) => {
    if (table === 'returns')           return { select: mockCountSelect }
    if (table === 'profiles')          return { update: mockUpdate, insert: mockInsert }
    if (table === 'client_depositors') return { insert: mockInsert, delete: mockDelete }
    return {}
  })

  // Default: admin client
  mockCreateUser.mockResolvedValue({ data: { user: { id: 'new-user-id' } }, error: null })
  mockGenerateLink.mockResolvedValue({
    data: { properties: { hashed_token: 'tok-123', action_link: 'http://magic-link' }, user: { id: 'new-user-id' } },
    error: null,
  })
  mockUpdateUserById.mockResolvedValue({ error: null })
})

// ─────────────────────────────────────────────────────────────────────
describe('toggleActiveAction', () => {
  it('nega desativação quando há devoluções pendentes', async () => {
    mockCountEq2.mockResolvedValue({ count: 3, error: null })

    const result = await toggleActiveAction('user-1', false)

    expect(result).toHaveProperty('error')
    expect((result as { error: string }).error).toContain('3')
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('desativa usuário quando não há pendências', async () => {
    mockCountEq2.mockResolvedValue({ count: 0, error: null })

    const result = await toggleActiveAction('user-1', false)

    expect(result).toEqual({ ok: true })
    expect(mockUpdate).toHaveBeenCalledWith({ active: false })
    expect(mockUpdateEq).toHaveBeenCalledWith('id', 'user-1')
  })

  it('ativa usuário sem verificar pendências', async () => {
    const result = await toggleActiveAction('user-2', true)

    expect(result).toEqual({ ok: true })
    // countSelect não deve ter sido chamado (active=true pula verificação)
    expect(mockCountSelect).not.toHaveBeenCalled()
    expect(mockUpdate).toHaveBeenCalledWith({ active: true })
  })

  it('retorna erro quando update do DB falha', async () => {
    mockUpdateEq.mockResolvedValue({ error: new Error('update error') })

    const result = await toggleActiveAction('user-1', true)

    expect(result).toEqual({ error: 'update error' })
  })
})

// ─────────────────────────────────────────────────────────────────────
describe('createUserAction', () => {
  const BASE_PAYLOAD = {
    email:        'novo@test.com',
    full_name:    'Novo Usuário',
    phone:        '',
    role:         'operator' as const,
    depositorIds: [],
  }

  it('cria usuário e retorna link de ativação no happy path', async () => {
    const result = await createUserAction(BASE_PAYLOAD)

    expect(result).toEqual({
      ok:        true,
      link:      'http://localhost:3000/auth/callback?token_hash=tok-123&type=magiclink',
      emailSent: true,
    })
    expect(mockCreateUser).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'novo@test.com', email_confirm: true }),
    )
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({ full_name: 'Novo Usuário', role: 'operator' }),
    )
  })

  it('vincula depositorIds quando role é client', async () => {
    const result = await createUserAction({
      ...BASE_PAYLOAD,
      role:         'client',
      depositorIds: ['dep-1', 'dep-2'],
    })

    expect(result).toMatchObject({ ok: true })
    expect(mockInsert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ client_id: 'new-user-id', depositor_id: 'dep-1' }),
        expect.objectContaining({ client_id: 'new-user-id', depositor_id: 'dep-2' }),
      ]),
    )
  })

  it('não vincula depositorIds quando role não é client', async () => {
    const insertCalls: unknown[] = []
    mockInsert.mockImplementation((arg: unknown) => {
      insertCalls.push(arg)
      return Promise.resolve({ error: null })
    })

    await createUserAction({ ...BASE_PAYLOAD, role: 'operator', depositorIds: ['dep-1'] })

    // Nenhum insert deve conter client_id (apenas o profile insert)
    for (const call of insertCalls) {
      expect(call).not.toHaveProperty('client_id')
    }
  })

  it('retorna erro quando createUser do auth falha', async () => {
    mockCreateUser.mockResolvedValue({ data: null, error: new Error('email already exists') })

    const result = await createUserAction(BASE_PAYLOAD)

    expect(result).toEqual({ error: 'email already exists' })
    expect(mockInsert).not.toHaveBeenCalled()
  })

  it('retorna erro quando insert do profile falha', async () => {
    mockInsert.mockResolvedValue({ error: new Error('constraint violation') })

    const result = await createUserAction(BASE_PAYLOAD)

    expect(result).toEqual({ error: 'constraint violation' })
  })
})

// ─────────────────────────────────────────────────────────────────────
describe('anonymizeUserAction', () => {
  it('anonimiza perfil e email de auth', async () => {
    const result = await anonymizeUserAction('user-to-anon')

    expect(result).toEqual({ ok: true })
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ full_name: '[ANONIMIZADO]', phone: null, active: false }),
    )
    expect(mockUpdateUserById).toHaveBeenCalledWith(
      'user-to-anon',
      expect.objectContaining({ email: expect.stringContaining('anon-') }),
    )
  })

  it('retorna erro quando update do profile falha', async () => {
    mockUpdateEq.mockResolvedValue({ error: new Error('profile update failed') })

    const result = await anonymizeUserAction('user-1')

    expect(result).toEqual({ error: 'profile update failed' })
    expect(mockUpdateUserById).not.toHaveBeenCalled()
  })

  it('retorna erro quando update do auth falha', async () => {
    mockUpdateUserById.mockResolvedValue({ error: new Error('auth update failed') })

    const result = await anonymizeUserAction('user-1')

    expect(result).toEqual({ error: 'auth update failed' })
  })
})
