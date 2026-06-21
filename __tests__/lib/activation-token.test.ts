import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Supabase admin client ────────────────────────────────────────────
// Builder encadeável: métodos retornam o próprio builder (thenable). O
// resultado padrão de cada operação é configurável via `opResult`.
let opResult: { data?: unknown; error?: unknown }
let maybeSingleResult: { data?: unknown; error?: unknown }
const calls = { delete: [] as unknown[], insert: [] as unknown[], update: [] as unknown[] }

function builder() {
  const b: Record<string, unknown> = {}
  const chain = () => b
  for (const m of ['select', 'eq', 'is']) b[m] = vi.fn(chain)
  b.delete = vi.fn(() => { calls.delete.push(true); return b })
  b.insert = vi.fn((arg: unknown) => { calls.insert.push(arg); return b })
  b.update = vi.fn((arg: unknown) => { calls.update.push(arg); return b })
  b.maybeSingle = vi.fn(() => Promise.resolve(maybeSingleResult))
  b.then = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
    Promise.resolve(opResult).then(resolve, reject)
  return b
}

const mockFrom = vi.fn(() => builder())
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => ({ from: mockFrom })),
}))

import { createActivationToken, consumeActivationToken, markActivationTokenUsed } from '@/lib/auth/activation-token'

beforeEach(() => {
  vi.clearAllMocks()
  opResult = { error: null }
  maybeSingleResult = { data: null, error: null }
  calls.delete = []
  calls.insert = []
  calls.update = []
})

describe('createActivationToken', () => {
  it('apaga tokens anteriores, insere o hash e retorna um segredo', async () => {
    const secret = await createActivationToken('user-1')

    expect(typeof secret).toBe('string')
    expect(secret.length).toBeGreaterThan(20)
    expect(calls.delete.length).toBe(1)
    expect(calls.insert.length).toBe(1)
    const inserted = calls.insert[0] as { token_hash: string; user_id: string }
    expect(inserted.user_id).toBe('user-1')
    // Guarda o hash, nunca o segredo plaintext.
    expect(inserted.token_hash).not.toBe(secret)
    expect(inserted.token_hash).toMatch(/^[a-f0-9]{64}$/)
  })

  it('propaga erro quando o insert falha', async () => {
    opResult = { error: new Error('insert failed') }
    await expect(createActivationToken('user-1')).rejects.toThrow('insert failed')
  })
})

describe('consumeActivationToken', () => {
  it('retorna user_id para token válido não usado', async () => {
    maybeSingleResult = { data: { user_id: 'user-9', used_at: null }, error: null }
    expect(await consumeActivationToken('seg')).toBe('user-9')
  })

  it('retorna null para token já usado', async () => {
    maybeSingleResult = { data: { user_id: 'user-9', used_at: '2025-01-01' }, error: null }
    expect(await consumeActivationToken('seg')).toBeNull()
  })

  it('retorna null para token inexistente', async () => {
    maybeSingleResult = { data: null, error: null }
    expect(await consumeActivationToken('seg')).toBeNull()
  })

  it('retorna null para segredo vazio (sem consultar o banco)', async () => {
    expect(await consumeActivationToken('')).toBeNull()
    expect(mockFrom).not.toHaveBeenCalled()
  })
})

describe('markActivationTokenUsed', () => {
  it('atualiza used_at do usuário', async () => {
    await markActivationTokenUsed('user-1')
    expect(calls.update.length).toBe(1)
    expect(calls.update[0]).toHaveProperty('used_at')
  })
})
