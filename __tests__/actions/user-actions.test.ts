import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  updateUserAction,
  resendMagicLinkAction,
  getUsersAction,
  getDepositorsListAction,
} from '@/app/(manager)/admin/usuarios/actions'

// ── assertManager → getCurrentUser ───────────────────────────────────
const getCurrentUser = vi.fn()
vi.mock('@/lib/supabase/get-current-user', () => ({
  getCurrentUser: () => getCurrentUser(),
}))

const emailMocks = vi.hoisted(() => ({
  sendAccountCreatedEmail: vi.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail:  vi.fn().mockResolvedValue(undefined),
}))
vi.mock('@/lib/integrations/email', () => emailMocks)

const activationMocks = vi.hoisted(() => ({ createActivationToken: vi.fn() }))
vi.mock('@/lib/auth/activation-token', () => activationMocks)

const envMock = vi.hoisted(() => ({ mailEnabled: true, appUrl: 'http://localhost:3000' }))
vi.mock('@/lib/env', () => ({ env: envMock }))

// ── Supabase server client (call recorder + per-table results) ───────
let tableResult: Record<string, { data?: unknown; error?: unknown }>
let tableSingle: Record<string, { data?: unknown; error?: unknown }>
const calls = { update: [] as unknown[], insert: [] as unknown[], delete: [] as boolean[] }

function builder(table: string) {
  const b: Record<string, unknown> = {}
  const chain = () => b
  for (const m of ['select', 'eq', 'neq', 'order', 'range']) b[m] = vi.fn(chain)
  b.update = vi.fn((arg: unknown) => { calls.update.push({ table, arg }); return b })
  b.insert = vi.fn((arg: unknown) => { calls.insert.push({ table, arg }); return b })
  b.delete = vi.fn(() => { calls.delete.push(true); return b })
  b.single = vi.fn(() => Promise.resolve(tableSingle[table] ?? { data: null, error: null }))
  b.then = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
    Promise.resolve(tableResult[table] ?? { data: null, error: null }).then(resolve, reject)
  return b
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({ from: (t: string) => builder(t) })),
}))

// ── Supabase admin client ────────────────────────────────────────────
const mockGenerateLink = vi.fn()
const mockListUsers    = vi.fn()
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => ({
    auth: { admin: { generateLink: mockGenerateLink, listUsers: mockListUsers } },
  })),
}))

function asManager() {
  getCurrentUser.mockResolvedValue({
    id: 'm-1', email: 'm@logvale.com',
    profile: { id: 'm-1', role: 'manager', active: true, full_name: 'M', phone: null, terms_accepted_at: '2024-01-01', created_at: '' },
  })
}

function asOperator() {
  getCurrentUser.mockResolvedValue({
    id: 'op-1', email: 'op@test.com',
    profile: { id: 'op-1', role: 'operator', active: true, full_name: 'Op', phone: null, terms_accepted_at: null, created_at: '' },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  asManager()
  envMock.mailEnabled = true
  tableResult = {}
  tableSingle = {}
  calls.update = []
  calls.insert = []
  calls.delete = []
  mockGenerateLink.mockResolvedValue({
    data: { properties: { hashed_token: 'tok-1' }, user: { id: 'u-1' } },
    error: null,
  })
  mockListUsers.mockResolvedValue({ data: { users: [], nextPage: null }, error: null })
  activationMocks.createActivationToken.mockResolvedValue('secret-xyz')
})

// ─────────────────────────────────────────────────────────────────────
describe('updateUserAction', () => {
  const BASE = { id: 'u-1', full_name: 'Novo Nome', phone: '11999', role: 'operator' as const, depositorIds: [] as string[] }

  it('atualiza perfil e remove vínculos antigos (operator, sem novos vínculos)', async () => {
    const result = await updateUserAction(BASE)

    expect(result).toEqual({ ok: true })
    expect(calls.update).toContainEqual({ table: 'profiles', arg: expect.objectContaining({ full_name: 'Novo Nome', role: 'operator' }) })
    expect(calls.delete.length).toBe(1)
    // operator não recria vínculos
    expect(calls.insert).not.toContainEqual(expect.objectContaining({ table: 'client_depositors' }))
  })

  it('recria vínculos quando role é client', async () => {
    const result = await updateUserAction({ ...BASE, role: 'client', depositorIds: ['dep-1', 'dep-2'] })

    expect(result).toEqual({ ok: true })
    expect(calls.insert).toContainEqual({
      table: 'client_depositors',
      arg: expect.arrayContaining([
        expect.objectContaining({ client_id: 'u-1', depositor_id: 'dep-1' }),
        expect.objectContaining({ client_id: 'u-1', depositor_id: 'dep-2' }),
      ]),
    })
  })

  it('propaga erro quando o update do perfil falha', async () => {
    tableResult.profiles = { error: new Error('profile update failed') }

    const result = await updateUserAction(BASE)

    expect(result).toEqual({ error: 'profile update failed' })
  })

  it('nega acesso a quem não é manager', async () => {
    asOperator()

    const result = await updateUserAction(BASE)

    expect(result).toEqual({ error: 'Acesso negado' })
  })
})

// ─────────────────────────────────────────────────────────────────────
describe('resendMagicLinkAction', () => {
  it('conta NÃO ativada ⇒ reenvia link de ativação (token próprio /ativar)', async () => {
    tableSingle.profiles = { data: { full_name: 'Fulano', terms_accepted_at: null }, error: null }

    const result = await resendMagicLinkAction('user@test.com')

    expect(activationMocks.createActivationToken).toHaveBeenCalledWith('u-1')
    expect(emailMocks.sendAccountCreatedEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'user@test.com', magicLink: 'http://localhost:3000/ativar?token=secret-xyz' }),
    )
    expect(emailMocks.sendPasswordResetEmail).not.toHaveBeenCalled()
    expect(result).toEqual({ link: 'http://localhost:3000/ativar?token=secret-xyz', mode: 'activation' })
  })

  it('conta ATIVADA ⇒ envia redefinição de senha (recovery)', async () => {
    tableSingle.profiles = { data: { full_name: 'Fulano', terms_accepted_at: '2024-01-01' }, error: null }

    const result = await resendMagicLinkAction('user@test.com')

    expect(emailMocks.sendPasswordResetEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'user@test.com', resetLink: expect.stringContaining('type=recovery') }),
    )
    expect(activationMocks.createActivationToken).not.toHaveBeenCalled()
    expect(result).toEqual({ link: 'http://localhost:3000/auth/callback?token_hash=tok-1&type=recovery', mode: 'recovery' })
  })

  it('não envia e-mail quando SMTP não configurado, mas ainda retorna o link', async () => {
    envMock.mailEnabled = false
    tableSingle.profiles = { data: { full_name: 'Fulano', terms_accepted_at: null }, error: null }

    const result = await resendMagicLinkAction('user@test.com')

    expect(emailMocks.sendAccountCreatedEmail).not.toHaveBeenCalled()
    expect(result).toEqual({ link: 'http://localhost:3000/ativar?token=secret-xyz', mode: 'activation' })
  })

  it('propaga erro quando generateLink falha', async () => {
    mockGenerateLink.mockResolvedValue({ data: null, error: new Error('link gen failed') })

    const result = await resendMagicLinkAction('user@test.com')

    expect(result).toEqual({ error: 'link gen failed' })
  })

  it('erro quando o token_hash de recovery não é gerado', async () => {
    tableSingle.profiles = { data: { full_name: 'Fulano', terms_accepted_at: '2024-01-01' }, error: null }
    // 1ª chamada (resolve) ok; 2ª (recovery) sem hashed_token.
    mockGenerateLink
      .mockResolvedValueOnce({ data: { properties: { hashed_token: 'tok-1' }, user: { id: 'u-1' } }, error: null })
      .mockResolvedValueOnce({ data: { properties: {}, user: { id: 'u-1' } }, error: null })

    const result = await resendMagicLinkAction('user@test.com')

    expect(result).toEqual({ error: 'Link não gerado' })
  })
})

// ─────────────────────────────────────────────────────────────────────
describe('getUsersAction', () => {
  it('combina auth users + profiles + vínculos e ordena por nome', async () => {
    mockListUsers.mockResolvedValue({
      data: {
        users: [
          { id: 'u-1', email: 'zeca@test.com' },
          { id: 'u-2', email: 'ana@test.com' },
        ],
        nextPage: null,
      },
      error: null,
    })
    tableResult.profiles = {
      data: [
        { id: 'u-1', full_name: 'Zeca', phone: null, role: 'client',  active: true, created_at: '' },
        { id: 'u-2', full_name: 'Ana',  phone: null, role: 'operator', active: true, created_at: '' },
      ],
      error: null,
    }
    tableResult.client_depositors = {
      data: [{ client_id: 'u-1', depositor_id: 'dep-1' }],
      error: null,
    }

    const result = await getUsersAction()

    expect(Array.isArray(result)).toBe(true)
    const rows = result as { full_name: string; depositorIds: string[] }[]
    expect(rows.map((r) => r.full_name)).toEqual(['Ana', 'Zeca']) // ordenado
    expect(rows.find((r) => r.full_name === 'Zeca')!.depositorIds).toEqual(['dep-1'])
  })

  it('propaga erro quando listUsers do auth falha', async () => {
    mockListUsers.mockResolvedValue({ data: null, error: new Error('auth list failed') })

    const result = await getUsersAction()

    expect(result).toEqual({ error: 'auth list failed' })
  })

  it('nega acesso a quem não é manager', async () => {
    asOperator()

    const result = await getUsersAction()

    expect(result).toEqual({ error: 'Acesso negado' })
  })
})

// ─────────────────────────────────────────────────────────────────────
describe('getDepositorsListAction', () => {
  it('retorna depositantes ativos', async () => {
    tableResult.depositors = { data: [{ id: 'dep-1', razao_social: 'Acme' }], error: null }

    const result = await getDepositorsListAction()

    expect(result).toEqual([{ id: 'dep-1', razao_social: 'Acme' }])
  })

  it('propaga erro do banco', async () => {
    tableResult.depositors = { data: null, error: new Error('query failed') }

    const result = await getDepositorsListAction()

    expect(result).toEqual({ error: 'query failed' })
  })
})
