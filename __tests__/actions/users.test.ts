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

vi.mock('@/lib/integrations/email', () => ({
  sendAccountCreatedEmail: vi.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail:  vi.fn().mockResolvedValue(undefined),
}))

const activationMocks = vi.hoisted(() => ({ createActivationToken: vi.fn() }))
vi.mock('@/lib/auth/activation-token', () => activationMocks)

vi.mock('@/lib/env', () => ({
  env: { mailEnabled: true, appUrl: 'http://localhost:3000' },
}))

// ── Supabase server client ────────────────────────────────────────────
// profiles.select('role').eq('id', …).single()
const mockProfileSingle = vi.fn()
const mockProfileEq     = vi.fn()
const mockProfileSelect = vi.fn()
// client_depositors.select('depositor_id').eq('client_id', …)
const mockLinksEq       = vi.fn()
const mockLinksSelect   = vi.fn()
// returns.select(…, { count, head }).in('depositor_id', …).eq('status', …)
const mockCountEq       = vi.fn()
const mockCountIn       = vi.fn()
const mockCountSelect   = vi.fn()
const mockUpdateEq    = vi.fn().mockResolvedValue({ error: null })
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
const mockDeleteUser     = vi.fn()

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => ({
    auth: {
      admin: {
        createUser:    mockCreateUser,
        generateLink:   mockGenerateLink,
        updateUserById: mockUpdateUserById,
        deleteUser:     mockDeleteUser,
      },
    },
  })),
}))

beforeEach(() => {
  vi.clearAllMocks()

  // Default: supabase server client
  mockProfileSingle.mockResolvedValue({ data: { role: 'client' }, error: null })
  mockProfileEq.mockReturnValue({ single: mockProfileSingle })
  mockProfileSelect.mockReturnValue({ eq: mockProfileEq })
  mockLinksEq.mockResolvedValue({ data: [{ depositor_id: 'dep-1' }, { depositor_id: 'dep-2' }], error: null })
  mockLinksSelect.mockReturnValue({ eq: mockLinksEq })
  mockCountEq.mockResolvedValue({ count: 0, error: null })
  mockCountIn.mockReturnValue({ eq: mockCountEq })
  mockCountSelect.mockReturnValue({ in: mockCountIn })
  mockUpdateEq.mockResolvedValue({ error: null })
  mockDeleteEq.mockResolvedValue({ error: null })
  mockInsert.mockResolvedValue({ error: null })

  mockFrom.mockImplementation((table: string) => {
    if (table === 'returns')           return { select: mockCountSelect }
    if (table === 'profiles')          return { select: mockProfileSelect, update: mockUpdate, insert: mockInsert }
    if (table === 'client_depositors') return { select: mockLinksSelect, insert: mockInsert, delete: mockDelete }
    return {}
  })

  // Default: admin client
  mockCreateUser.mockResolvedValue({ data: { user: { id: 'new-user-id' } }, error: null })
  mockGenerateLink.mockResolvedValue({
    data: { properties: { hashed_token: 'tok-123', action_link: 'http://magic-link' }, user: { id: 'new-user-id' } },
    error: null,
  })
  mockUpdateUserById.mockResolvedValue({ error: null })
  mockDeleteUser.mockResolvedValue({ error: null })
  activationMocks.createActivationToken.mockResolvedValue('secret-abc')
})

// ─────────────────────────────────────────────────────────────────────
describe('toggleActiveAction', () => {
  it('nega desativação de cliente com devoluções pendentes nos depositantes dele', async () => {
    mockCountEq.mockResolvedValue({ count: 3, error: null })

    const result = await toggleActiveAction('user-1', false)

    expect(result).toHaveProperty('error')
    expect((result as { error: string }).error).toContain('3')
    // Pendências vêm via depositantes (returns não tem client_id).
    expect(mockLinksEq).toHaveBeenCalledWith('client_id', 'user-1')
    expect(mockCountIn).toHaveBeenCalledWith('depositor_id', ['dep-1', 'dep-2'])
    expect(mockCountEq).toHaveBeenCalledWith('status', 'awaiting_decision')
    expect(mockUpdate).not.toHaveBeenCalled()
    expect(mockUpdateUserById).not.toHaveBeenCalled()
  })

  it('desativa cliente sem pendências e bloqueia o login no Auth', async () => {
    const result = await toggleActiveAction('user-1', false)

    expect(result).toEqual({ ok: true })
    expect(mockUpdate).toHaveBeenCalledWith({ active: false })
    expect(mockUpdateEq).toHaveBeenCalledWith('id', 'user-1')
    expect(mockUpdateUserById).toHaveBeenCalledWith('user-1', { ban_duration: '876000h' })
  })

  it('desativa cliente sem depositantes sem consultar devoluções', async () => {
    mockLinksEq.mockResolvedValue({ data: [], error: null })

    const result = await toggleActiveAction('user-1', false)

    expect(result).toEqual({ ok: true })
    expect(mockCountSelect).not.toHaveBeenCalled()
  })

  it('não verifica pendências ao desativar quem não é cliente', async () => {
    mockProfileSingle.mockResolvedValue({ data: { role: 'operator' }, error: null })

    const result = await toggleActiveAction('op-1', false)

    expect(result).toEqual({ ok: true })
    expect(mockLinksSelect).not.toHaveBeenCalled()
    expect(mockCountSelect).not.toHaveBeenCalled()
    expect(mockUpdate).toHaveBeenCalledWith({ active: false })
  })

  it('ativa usuário sem verificar pendências e libera o login', async () => {
    const result = await toggleActiveAction('user-2', true)

    expect(result).toEqual({ ok: true })
    expect(mockLinksSelect).not.toHaveBeenCalled()
    expect(mockCountSelect).not.toHaveBeenCalled()
    expect(mockUpdate).toHaveBeenCalledWith({ active: true })
    expect(mockUpdateUserById).toHaveBeenCalledWith('user-2', { ban_duration: 'none' })
  })

  it('recusa reativar usuário anonimizado (não tira o ban do login)', async () => {
    mockProfileSingle.mockResolvedValue({ data: { role: 'client', full_name: '[ANONIMIZADO]' }, error: null })

    const result = await toggleActiveAction('user-3', true)

    expect(result).toEqual({ error: 'Usuário anonimizado não pode ser reativado.' })
    expect(mockUpdateUserById).not.toHaveBeenCalled()
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('permite desativar usuário anonimizado que ainda esteja ativo', async () => {
    mockProfileSingle.mockResolvedValue({ data: { role: 'operator', full_name: '[ANONIMIZADO]' }, error: null })

    const result = await toggleActiveAction('user-3', false)

    expect(result).toEqual({ ok: true })
    expect(mockUpdateUserById).toHaveBeenCalledWith('user-3', { ban_duration: '876000h' })
  })

  it('retorna erro quando a consulta de pendências falha', async () => {
    mockCountEq.mockResolvedValue({ count: null, error: new Error('query error') })

    const result = await toggleActiveAction('user-1', false)

    expect(result).toEqual({ error: 'query error' })
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('bloqueia o login ANTES de gravar o perfil', async () => {
    const order: string[] = []
    mockUpdateUserById.mockImplementation(async () => { order.push('auth'); return { error: null } })
    mockUpdateEq.mockImplementation(async () => { order.push('profile'); return { error: null } })

    await toggleActiveAction('user-1', false)

    expect(order).toEqual(['auth', 'profile'])
  })

  it('quando o update do perfil falha, desfaz o desbloqueio do login', async () => {
    mockUpdateEq.mockResolvedValue({ error: new Error('update error') })

    const result = await toggleActiveAction('user-1', true)

    expect(result).toEqual({ error: 'update error' })
    expect(mockUpdateUserById).toHaveBeenNthCalledWith(1, 'user-1', { ban_duration: 'none' })
    expect(mockUpdateUserById).toHaveBeenNthCalledWith(2, 'user-1', { ban_duration: '876000h' })
  })

  it('quando o update do perfil falha na desativação, libera o login de novo', async () => {
    mockUpdateEq.mockResolvedValue({ error: new Error('update error') })

    const result = await toggleActiveAction('user-1', false)

    expect(result).toEqual({ error: 'update error' })
    expect(mockUpdateUserById).toHaveBeenNthCalledWith(1, 'user-1', { ban_duration: '876000h' })
    expect(mockUpdateUserById).toHaveBeenNthCalledWith(2, 'user-1', { ban_duration: 'none' })
  })

  it('avisa quando nem o desfazer do login funciona', async () => {
    mockUpdateEq.mockResolvedValue({ error: new Error('update error') })
    mockUpdateUserById
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({ error: new Error('auth down') })

    const result = await toggleActiveAction('user-1', false)

    expect((result as { error: string }).error).toContain('não foi possível desfazer o bloqueio')
  })

  it('quando o bloqueio do login no Auth falha, não altera o perfil', async () => {
    mockUpdateUserById.mockResolvedValue({ error: new Error('auth down') })

    const result = await toggleActiveAction('user-1', false)

    expect(result).toHaveProperty('error')
    expect((result as { error: string }).error).toContain('bloquear o login')
    expect((result as { error: string }).error).toContain('Nada foi alterado')
    expect(mockUpdate).not.toHaveBeenCalled()
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
      link:      'http://localhost:3000/ativar?token=secret-abc',
      emailSent: true,
    })
    expect(mockCreateUser).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'novo@test.com', email_confirm: true }),
    )
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({ full_name: 'Novo Usuário', role: 'operator' }),
    )
    expect(activationMocks.createActivationToken).toHaveBeenCalledWith('new-user-id')
    expect(mockDeleteUser).not.toHaveBeenCalled()
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

  it('faz rollback (deleteUser) quando insert do profile falha', async () => {
    mockInsert.mockResolvedValue({ error: new Error('constraint violation') })

    const result = await createUserAction(BASE_PAYLOAD)

    expect(result).toEqual({ error: 'constraint violation' })
    // Não deixa usuário Auth órfão.
    expect(mockDeleteUser).toHaveBeenCalledWith('new-user-id')
  })

  it('não chama deleteUser quando o próprio createUser do auth falha', async () => {
    mockCreateUser.mockResolvedValue({ data: null, error: new Error('email already exists') })

    await createUserAction(BASE_PAYLOAD)

    expect(mockDeleteUser).not.toHaveBeenCalled()
  })
})

// ─────────────────────────────────────────────────────────────────────
const ANON_ID = '11111111-2222-4333-8444-555555555555'

describe('anonymizeUserAction', () => {
  it('recusa id que não é UUID', async () => {
    const result = await anonymizeUserAction('nao-uuid')

    expect(result).toEqual({ error: 'Usuário inválido' })
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('nega excluir cliente com devoluções pendentes nos depositantes dele', async () => {
    mockCountEq.mockResolvedValue({ count: 2, error: null })

    const result = await anonymizeUserAction(ANON_ID)

    expect(result).toEqual({ error: expect.stringContaining('2 devolução(ões) aguardando decisão') })
    expect(mockUpdate).not.toHaveBeenCalled()
    expect(mockUpdateUserById).not.toHaveBeenCalled()
  })

  it('não checa pendências de operador', async () => {
    mockProfileSingle.mockResolvedValue({ data: { role: 'operator', full_name: 'Op' }, error: null })
    mockCountEq.mockResolvedValue({ count: 5, error: null })

    const result = await anonymizeUserAction(ANON_ID)

    expect(result).toEqual({ ok: true })
    expect(mockLinksSelect).not.toHaveBeenCalled()
  })

  it('anonimiza perfil e email de auth', async () => {
    const result = await anonymizeUserAction(ANON_ID)

    expect(result).toEqual({ ok: true })
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ full_name: '[ANONIMIZADO]', phone: null, active: false }),
    )
    expect(mockUpdateUserById).toHaveBeenCalledWith(
      ANON_ID,
      expect.objectContaining({ email: expect.stringContaining('anon-'), ban_duration: '876000h' }),
    )
  })

  it('retorna erro quando update do profile falha', async () => {
    mockUpdateEq.mockResolvedValue({ error: new Error('profile update failed') })

    const result = await anonymizeUserAction(ANON_ID)

    expect(result).toEqual({ error: 'profile update failed' })
    expect(mockUpdateUserById).not.toHaveBeenCalled()
  })

  it('retorna erro quando update do auth falha', async () => {
    mockUpdateUserById.mockResolvedValue({ error: new Error('auth update failed') })

    const result = await anonymizeUserAction(ANON_ID)

    expect(result).toEqual({ error: 'auth update failed' })
  })
})
