import { describe, it, expect, vi, beforeEach } from 'vitest'
import { updateReturnAction, getEditReturnDataAction } from '@/lib/actions/edit-return'
import type { ReturnEditInput } from '@/lib/return-edit'

let role: 'operator' | 'manager' | 'client' = 'operator'
vi.mock('@/lib/supabase/get-current-user', () => ({
  getCurrentUser: vi.fn(() => Promise.resolve({ id: 'u-1', email: 'u@test.com', profile: { role } })),
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => ({ from: () => builder('profiles') })),
}))

// Builder encadeável por tabela: registra update/insert e resolve com o
// resultado configurado para a tabela.
let results: Record<string, { data?: unknown; error?: unknown }> = {}
let updates: Record<string, unknown>[] = []
let inserts: Record<string, unknown>[] = []
let updateError: { code?: string; message: string } | null = null

function builder(table: string) {
  const b: Record<string, unknown> = {}
  let mode: 'read' | 'update' | 'insert' = 'read'
  for (const m of ['select', 'eq', 'in', 'order']) b[m] = () => b
  b.update = (v: Record<string, unknown>) => { mode = 'update'; updates.push(v); return b }
  b.insert = (v: Record<string, unknown>) => { mode = 'insert'; inserts.push(v); return b }
  b.single = () => Promise.resolve(results[table] ?? { data: null, error: null })
  b.then = (ok: (v: unknown) => unknown, ko?: (e: unknown) => unknown) => {
    const r =
      mode === 'update' ? { error: updateError } :
      mode === 'insert' ? { error: null } :
      results[table] ?? { data: [], error: null }
    return Promise.resolve(r).then(ok, ko)
  }
  return b
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({ from: (t: string) => builder(t) })),
}))

const RETURN = {
  id:                  'ret-1',
  status:              'awaiting_decision',
  received_at:         '2026-11-10T12:00:00Z',
  decision_deadline_from: null,
  rv:                  'RV-001',
  identifier_type:     'postal_code',
  access_key:          null,
  postal_code:         '01310100',
  logistics_code:      null,
  illegible_token:     null,
  item_count:          3,
  damaged_item_count:  0,
  depositor_id:        'dep-1',
  final_customer_name: null,
}

const DEPOSITORS = [
  { id: 'dep-1', razao_social: 'ACME',       active: true, cnpj: '1', no_decision_deadline: false },
  { id: 'dep-2', razao_social: 'OUTRA',      active: true, cnpj: '2', no_decision_deadline: false },
  { id: 'dep-3', razao_social: 'BLACKSKULL', active: true, cnpj: '3', no_decision_deadline: true },
]

const INPUT: ReturnEditInput = {
  rv:                'RV-001',
  identifierType:    'postal_code',
  accessKey:         null,
  postalCode:        '01310100',
  logisticsCode:     null,
  itemCount:         3,
  damagedItemCount:  0,
  depositorId:       'dep-1',
  finalCustomerName: null,
  restartDeadline:   null,
}

beforeEach(() => {
  role        = 'operator'
  updates     = []
  inserts     = []
  updateError = null
  results = {
    returns:    { data: { ...RETURN }, error: null },
    depositors: { data: DEPOSITORS, error: null },
    profiles:   { data: [], error: null },
  }
})

describe('updateReturnAction', () => {
  it('nega cliente', async () => {
    role = 'client'
    expect(await updateReturnAction('ret-1', INPUT)).toEqual({ error: 'Acesso negado' })
    expect(updates).toHaveLength(0)
  })

  it('operador não edita devolução já decidida', async () => {
    results.returns = { data: { ...RETURN, status: 'decided' }, error: null }
    const res = await updateReturnAction('ret-1', { ...INPUT, rv: 'RV-002' })
    expect(res).toMatchObject({ error: expect.stringMatching(/gerente/) })
    expect(updates).toHaveLength(0)
  })

  it('gerente edita devolução processada', async () => {
    role = 'manager'
    results.returns = { data: { ...RETURN, status: 'processed' }, error: null }
    const res = await updateReturnAction('ret-1', { ...INPUT, rv: 'RV-002' })
    expect(res).toEqual({ ok: true })
    expect(updates[0]).toMatchObject({ rv: 'RV-002' })
  })

  it('sem alteração não grava', async () => {
    expect(await updateReturnAction('ret-1', INPUT)).toEqual({ error: 'Nenhuma alteração para salvar.' })
    expect(updates).toHaveLength(0)
  })

  it('grava a edição e o histórico (antes/depois)', async () => {
    const res = await updateReturnAction('ret-1', { ...INPUT, itemCount: 4, damagedItemCount: 1 })
    expect(res).toEqual({ ok: true })
    expect(updates[0]).toMatchObject({ item_count: 4, damaged_item_count: 1 })
    expect(updates[0]).not.toHaveProperty('decision_deadline_from')
    expect(inserts[0]).toMatchObject({
      return_id:          'ret-1',
      edited_by:          'u-1',
      deadline_restarted: false,
      changes: [{ field: 'items', label: 'Itens / estado', from: '3 itens · Bom', to: '4 itens · Avaria (1 de 4)' }],
    })
  })

  it('troca de depositante aguardando decisão exige a escolha do prazo', async () => {
    const res = await updateReturnAction('ret-1', { ...INPUT, depositorId: 'dep-2' })
    expect(res).toMatchObject({ error: expect.stringMatching(/prazo/) })
    expect(updates).toHaveLength(0)
  })

  it('reinicia o prazo quando escolhido', async () => {
    const res = await updateReturnAction('ret-1', { ...INPUT, depositorId: 'dep-2', restartDeadline: true })
    expect(res).toEqual({ ok: true })
    expect(updates[0]).toMatchObject({ depositor_id: 'dep-2', warning_sent_at: null })
    expect(updates[0].decision_deadline_from).toEqual(expect.any(String))
    expect(inserts[0]).toMatchObject({
      deadline_restarted: true,
      changes: [{ field: 'depositor', from: 'ACME', to: 'OUTRA' }],
    })
  })

  it('mantém o prazo quando escolhido', async () => {
    const res = await updateReturnAction('ret-1', { ...INPUT, depositorId: 'dep-2', restartDeadline: false })
    expect(res).toEqual({ ok: true })
    expect(updates[0]).not.toHaveProperty('decision_deadline_from')
  })

  it('depositante sem prazo (Blackskull) não pergunta', async () => {
    const res = await updateReturnAction('ret-1', { ...INPUT, depositorId: 'dep-3' })
    expect(res).toEqual({ ok: true })
    expect(updates[0]).not.toHaveProperty('decision_deadline_from')
  })

  it('chave alterada pela equipe limpa a procedência "informada pelo cliente"', async () => {
    const key = '35241112345678000199550010000012341123456780'
    const { accessKeyCheckDigit } = await import('@/lib/access-key')
    const valid = key.slice(0, 43) + accessKeyCheckDigit(key.slice(0, 43))
    const res = await updateReturnAction('ret-1', { ...INPUT, accessKey: valid })
    expect(res).toEqual({ ok: true })
    expect(updates[0]).toMatchObject({
      access_key: valid, access_key_informed_by: null, access_key_informed_at: null,
    })
  })

  it('RV duplicado vira mensagem amigável', async () => {
    updateError = { code: '23505', message: 'duplicate key' }
    const res = await updateReturnAction('ret-1', { ...INPUT, rv: 'RV-999' })
    expect(res).toEqual({ error: 'Já existe outra devolução com o RV "RV-999".' })
    expect(inserts).toHaveLength(0)
  })
})

describe('getEditReturnDataAction', () => {
  it('devolve o estado atual e a base do prazo', async () => {
    const res = await getEditReturnDataAction('ret-1')
    if ('error' in res) throw new Error(res.error)
    expect(res.data).toMatchObject({
      rv: 'RV-001', depositorId: 'dep-1', deadlineFrom: RETURN.received_at, status: 'awaiting_decision',
    })
    expect(res.data.depositors.map((d) => d.id)).toEqual(['dep-1', 'dep-2', 'dep-3'])
  })

  it('operador não abre a edição de uma decidida', async () => {
    results.returns = { data: { ...RETURN, status: 'decided' }, error: null }
    expect(await getEditReturnDataAction('ret-1')).toMatchObject({ error: expect.stringMatching(/gerente/) })
  })
})
