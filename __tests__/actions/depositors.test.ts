import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  addDepositorCnpjAction,
  createDepositorAction,
  getDepositorUsageAction,
  reactivateDepositorAction,
  removeDepositorAction,
  removeDepositorCnpjAction,
  updateDepositorAction,
} from '@/app/(manager)/admin/depositantes/actions'

// assertManager usa getCurrentUser internamente
vi.mock('@/lib/supabase/get-current-user', () => ({
  getCurrentUser: vi.fn().mockResolvedValue({
    id:      'm-1',
    email:   'm@logvale.com',
    profile: { id: 'm-1', role: 'manager', active: true, full_name: 'Manager', phone: null, terms_accepted_at: '2024-01-01', created_at: '' },
  }),
}))

const mockSingle           = vi.fn()
const mockSelectAfterInsert = vi.fn().mockReturnValue({ single: mockSingle })
const mockInsert            = vi.fn().mockReturnValue({ select: mockSelectAfterInsert })
const mockEq                = vi.fn()
const mockUpdate            = vi.fn().mockReturnValue({ eq: mockEq })
const mockFrom              = vi.fn()

// depositors.select('cnpj').eq('id', …).maybeSingle() — principal, na remoção
const mockDepMaybeSingle    = vi.fn()
const mockDepSelect         = vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: mockDepMaybeSingle })) }))

// depositor_cnpjs.select(…) — o resultado depende dos filtros:
//   eq('cnpj', …)          → quem tem o CNPJ (ownersResult)
//   eq('depositor_id', …)  → CNPJs do depositante (ownCnpjsResult)
//   in('cnpj', …)…         → CNPJs em uso por outro ativo, na reativação (clashResult)
type QueryResult = { data: unknown; error: unknown }
let ownersResult:   QueryResult = { data: [], error: null }
let ownCnpjsResult: QueryResult = { data: [], error: null }
let clashResult:    QueryResult = { data: [], error: null }
const cnpjQueryCalls: [string, string, unknown][] = []

interface CnpjChain {
  eq:   (col: string, val: unknown) => CnpjChain
  in:   (col: string, val: unknown) => CnpjChain
  neq:  (col: string, val: unknown) => CnpjChain
  then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) => Promise<unknown>
}
function depositorCnpjsQuery(): CnpjChain {
  const filters: [string, string, unknown][] = []
  const push = (op: string) => (col: string, val: unknown): CnpjChain => {
    filters.push([op, col, val])
    cnpjQueryCalls.push([op, col, val])
    return q
  }
  const q: CnpjChain = {
    eq:  push('eq'),
    in:  push('in'),
    neq: push('neq'),
    then: (resolve, reject) => {
      const r = filters.some(([op]) => op === 'in') ? clashResult
        : filters.some(([, col]) => col === 'depositor_id') ? ownCnpjsResult
        : ownersResult
      return Promise.resolve(r).then(resolve, reject)
    },
  }
  return q
}

// depositor_cnpjs: insert e delete → eq → eq
const mockCnpjInsert        = vi.fn()
const mockCnpjDeleteEq2     = vi.fn()
const mockCnpjDeleteEq1     = vi.fn(() => ({ eq: mockCnpjDeleteEq2 }))
const mockCnpjDelete        = vi.fn(() => ({ eq: mockCnpjDeleteEq1 }))

// depositors.delete().eq('id', …).select('id')
let deleteResult: { data: unknown; error: unknown } = { data: [{ id: 'dep-1' }], error: null }
const mockDepDeleteEq = vi.fn(() => ({ select: vi.fn(() => Promise.resolve(deleteResult)) }))
const mockDepDelete   = vi.fn(() => ({ eq: mockDepDeleteEq }))

// Contagens (select com { count, head }): returns total / aguardando e clientes vinculados.
const counts = { returns: 0, awaiting: 0, clients: 0 }
function returnsCountQuery() {
  const filters: string[] = []
  const q = {
    eq: (col: string) => { filters.push(col); return q },
    then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
      Promise.resolve({ count: filters.includes('status') ? counts.awaiting : counts.returns, error: null })
        .then(resolve, reject),
  }
  return q
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({ from: mockFrom })),
}))

const PRINCIPAL = '12345678000195'
const EXTRA     = '98765432000110'

beforeEach(() => {
  vi.clearAllMocks()
  mockSingle.mockResolvedValue({ data: { id: 'dep-new' }, error: null })
  mockSelectAfterInsert.mockReturnValue({ single: mockSingle })
  mockInsert.mockReturnValue({ select: mockSelectAfterInsert })
  mockEq.mockResolvedValue({ error: null })
  mockDepMaybeSingle.mockResolvedValue({ data: { cnpj: PRINCIPAL }, error: null })
  ownersResult   = { data: [], error: null }
  ownCnpjsResult = { data: [{ cnpj: PRINCIPAL }], error: null }
  clashResult    = { data: [], error: null }
  cnpjQueryCalls.length = 0
  mockCnpjInsert.mockResolvedValue({ error: null })
  mockCnpjDeleteEq2.mockResolvedValue({ error: null })
  deleteResult = { data: [{ id: 'dep-1' }], error: null }
  counts.returns = 0
  counts.awaiting = 0
  counts.clients = 0
  mockFrom.mockImplementation((table: string) => {
    if (table === 'depositors') {
      return { insert: mockInsert, update: mockUpdate, select: mockDepSelect, delete: mockDepDelete }
    }
    if (table === 'depositor_cnpjs') {
      return { select: vi.fn(() => depositorCnpjsQuery()), insert: mockCnpjInsert, delete: mockCnpjDelete }
    }
    if (table === 'returns') return { select: vi.fn(() => returnsCountQuery()) }
    if (table === 'client_depositors') {
      return { select: vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ count: counts.clients, error: null })) })) }
    }
    return {}
  })
})

describe('createDepositorAction', () => {
  it('retorna erro para CNPJ com menos de 14 dígitos', async () => {
    const result = await createDepositorAction({ cnpj: '1234567800019', razao_social: 'Empresa X' })

    expect(result).toEqual({ error: 'CNPJ deve ter 14 dígitos' })
    expect(mockInsert).not.toHaveBeenCalled()
  })

  it('strip de máscara e valida CNPJ formatado (12.345.678/0001-99)', async () => {
    const result = await createDepositorAction({ cnpj: '12.345.678/0001-99', razao_social: 'Empresa Y' })

    // 12345678000199 tem 14 dígitos → deve inserir
    expect(result).toMatchObject({ ok: true })
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({ cnpj: '12345678000199' }),
    )
  })

  it('cria depositante com CNPJ válido e retorna {ok:true}', async () => {
    const result = await createDepositorAction({ cnpj: '12345678000195', razao_social: 'TechStore' })

    expect(result).toMatchObject({ ok: true })
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({ cnpj: '12345678000195', razao_social: 'TechStore' }),
    )
  })

  it('revalida /admin/depositantes após criação', async () => {
    const { revalidatePath } = await import('next/cache')

    await createDepositorAction({ cnpj: '12345678000195', razao_social: 'TechStore' })

    expect(revalidatePath).toHaveBeenCalledWith('/admin/depositantes')
  })

  it('retorna erro quando DB falha', async () => {
    mockSingle.mockResolvedValue({ data: null, error: new Error('unique_violation') })

    const result = await createDepositorAction({ cnpj: '12345678000195', razao_social: 'Dup' })

    expect(result).toEqual({ error: 'unique_violation' })
  })

  it('recusa CNPJ que já é de outro depositante ativo (principal ou adicional), dizendo de qual', async () => {
    ownersResult = { data: [{ depositor_id: 'dep-9', active: true, depositors: { razao_social: 'Grupo Z' } }], error: null }

    const result = await createDepositorAction({ cnpj: EXTRA, razao_social: 'Nova' })

    expect(cnpjQueryCalls).toContainEqual(['eq', 'cnpj', EXTRA])
    expect(result).toEqual({ error: 'Este CNPJ já está cadastrado em Grupo Z.' })
    expect(mockInsert).not.toHaveBeenCalled()
  })

  it('aceita CNPJ de um depositante desativado (027)', async () => {
    ownersResult = { data: [{ depositor_id: 'dep-9', active: false, depositors: { razao_social: 'Antigo' } }], error: null }

    const result = await createDepositorAction({ cnpj: EXTRA, razao_social: 'Nova' })

    expect(result).toMatchObject({ ok: true })
    expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({ cnpj: EXTRA }))
  })

  it('23505 (corrida) vira mensagem amigável', async () => {
    mockSingle.mockResolvedValue({ data: null, error: { code: '23505', message: 'duplicate key value' } })

    const result = await createDepositorAction({ cnpj: PRINCIPAL, razao_social: 'Dup' })

    expect(result).toEqual({ error: 'Este CNPJ já está cadastrado em outro depositante ativo.' })
  })
})

describe('addDepositorCnpjAction', () => {
  it('adiciona o CNPJ (sem máscara) ao depositante', async () => {
    const { revalidatePath } = await import('next/cache')

    const result = await addDepositorCnpjAction({ depositorId: 'dep-1', cnpj: '98.765.432/0001-10' })

    expect(result).toEqual({ ok: true, cnpj: EXTRA })
    expect(mockCnpjInsert).toHaveBeenCalledWith({ cnpj: EXTRA, depositor_id: 'dep-1' })
    expect(revalidatePath).toHaveBeenCalledWith('/admin/depositantes')
  })

  it('exige 14 dígitos', async () => {
    const result = await addDepositorCnpjAction({ depositorId: 'dep-1', cnpj: '9876543200011' })

    expect(result).toEqual({ error: 'CNPJ deve ter 14 dígitos' })
    expect(mockCnpjInsert).not.toHaveBeenCalled()
  })

  it('avisa quando o CNPJ já é deste depositante', async () => {
    ownersResult = { data: [{ depositor_id: 'dep-1', active: true, depositors: { razao_social: 'ACME' } }], error: null }

    const result = await addDepositorCnpjAction({ depositorId: 'dep-1', cnpj: EXTRA })

    expect(result).toEqual({ error: 'Este CNPJ já está cadastrado neste depositante.' })
    expect(mockCnpjInsert).not.toHaveBeenCalled()
  })

  it('recusa CNPJ de outro depositante ativo, dizendo de qual', async () => {
    ownersResult = { data: [{ depositor_id: 'dep-9', active: true, depositors: { razao_social: 'Grupo Z' } }], error: null }

    const result = await addDepositorCnpjAction({ depositorId: 'dep-1', cnpj: EXTRA })

    expect(result).toEqual({ error: 'Este CNPJ já está cadastrado em Grupo Z.' })
    expect(mockCnpjInsert).not.toHaveBeenCalled()
  })

  it('aceita CNPJ de um depositante desativado (027)', async () => {
    ownersResult = { data: [{ depositor_id: 'dep-9', active: false, depositors: { razao_social: 'Antigo' } }], error: null }

    const result = await addDepositorCnpjAction({ depositorId: 'dep-1', cnpj: EXTRA })

    expect(result).toEqual({ ok: true, cnpj: EXTRA })
    expect(mockCnpjInsert).toHaveBeenCalledWith({ cnpj: EXTRA, depositor_id: 'dep-1' })
  })

  it('23505 (corrida) vira mensagem amigável', async () => {
    mockCnpjInsert.mockResolvedValue({ error: { code: '23505', message: 'duplicate key value' } })

    const result = await addDepositorCnpjAction({ depositorId: 'dep-1', cnpj: EXTRA })

    expect(result).toEqual({ error: 'Este CNPJ já está cadastrado em outro depositante ativo.' })
  })
})

describe('removeDepositorCnpjAction', () => {
  it('remove um CNPJ adicional', async () => {
    const result = await removeDepositorCnpjAction({ depositorId: 'dep-1', cnpj: EXTRA })

    expect(result).toEqual({ ok: true })
    expect(mockCnpjDeleteEq1).toHaveBeenCalledWith('depositor_id', 'dep-1')
    expect(mockCnpjDeleteEq2).toHaveBeenCalledWith('cnpj', EXTRA)
  })

  it('não remove o CNPJ principal', async () => {
    const result = await removeDepositorCnpjAction({ depositorId: 'dep-1', cnpj: PRINCIPAL })

    expect(result).toEqual({ error: 'O CNPJ principal não pode ser removido.' })
    expect(mockCnpjDelete).not.toHaveBeenCalled()
  })

  it('erro quando o depositante não existe', async () => {
    mockDepMaybeSingle.mockResolvedValue({ data: null, error: null })

    const result = await removeDepositorCnpjAction({ depositorId: 'dep-x', cnpj: EXTRA })

    expect(result).toEqual({ error: 'Depositante não encontrado.' })
    expect(mockCnpjDelete).not.toHaveBeenCalled()
  })
})

describe('getDepositorUsageAction', () => {
  it('conta devoluções, aguardando decisão e clientes vinculados', async () => {
    counts.returns = 5
    counts.awaiting = 2
    counts.clients = 1

    expect(await getDepositorUsageAction('dep-1')).toEqual({ data: { returns: 5, awaiting: 2, clients: 1 } })
  })
})

describe('removeDepositorAction', () => {
  it('sem devoluções → exclui de vez', async () => {
    const { revalidatePath } = await import('next/cache')

    const result = await removeDepositorAction('dep-1')

    expect(result).toEqual({ ok: true, mode: 'deleted' })
    expect(mockDepDeleteEq).toHaveBeenCalledWith('id', 'dep-1')
    expect(mockUpdate).not.toHaveBeenCalled()
    expect(revalidatePath).toHaveBeenCalledWith('/admin/depositantes')
  })

  it('com devoluções → desativa e não exclui', async () => {
    counts.returns = 3

    const result = await removeDepositorAction('dep-1')

    expect(result).toEqual({ ok: true, mode: 'deactivated' })
    expect(mockUpdate).toHaveBeenCalledWith({ active: false })
    expect(mockEq).toHaveBeenCalledWith('id', 'dep-1')
    expect(mockDepDelete).not.toHaveBeenCalled()
  })

  it('devolução criada no meio-tempo (FK 23503) → desativa', async () => {
    deleteResult = { data: null, error: { code: '23503', message: 'violates foreign key constraint' } }

    const result = await removeDepositorAction('dep-1')

    expect(result).toEqual({ ok: true, mode: 'deactivated' })
    expect(mockUpdate).toHaveBeenCalledWith({ active: false })
  })

  it('depositante inexistente', async () => {
    deleteResult = { data: [], error: null }

    expect(await removeDepositorAction('dep-x')).toEqual({ error: 'Depositante não encontrado.' })
  })
})

describe('reactivateDepositorAction', () => {
  it('reativa o depositante quando nenhum CNPJ dele está em uso', async () => {
    ownCnpjsResult = { data: [{ cnpj: PRINCIPAL }, { cnpj: EXTRA }], error: null }

    const result = await reactivateDepositorAction('dep-1')

    expect(result).toEqual({ ok: true })
    // Procura conflito só entre os outros ativos, com todos os CNPJs dele.
    expect(cnpjQueryCalls).toContainEqual(['in', 'cnpj', [PRINCIPAL, EXTRA]])
    expect(cnpjQueryCalls).toContainEqual(['eq', 'active', true])
    expect(cnpjQueryCalls).toContainEqual(['neq', 'depositor_id', 'dep-1'])
    expect(mockUpdate).toHaveBeenCalledWith({ active: true })
    expect(mockEq).toHaveBeenCalledWith('id', 'dep-1')
  })

  it('recusa quando o CNPJ principal está em uso por outro ativo', async () => {
    clashResult = { data: [{ cnpj: PRINCIPAL, depositors: { razao_social: 'Novo Dono' } }], error: null }

    const result = await reactivateDepositorAction('dep-1')

    expect(result).toEqual({
      error: 'Não dá para reativar: o CNPJ principal 12.345.678/0001-95 está em uso por Novo Dono.',
    })
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('recusa quando um CNPJ adicional está em uso, orientando a removê-lo', async () => {
    ownCnpjsResult = { data: [{ cnpj: PRINCIPAL }, { cnpj: EXTRA }], error: null }
    clashResult = { data: [{ cnpj: EXTRA, depositors: { razao_social: 'Novo Dono' } }], error: null }

    const result = await reactivateDepositorAction('dep-1')

    expect(result).toMatchObject({ error: expect.stringContaining('98.765.432/0001-10 está em uso por Novo Dono') })
    expect(result).toMatchObject({ error: expect.stringContaining('Remova esse CNPJ adicional') })
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('23505 (corrida) vira mensagem amigável', async () => {
    mockEq.mockResolvedValue({ error: { code: '23505', message: 'duplicate key value' } })

    const result = await reactivateDepositorAction('dep-1')

    expect(result).toMatchObject({ error: expect.stringContaining('em uso por outro depositante ativo') })
  })

  it('erro quando o depositante não existe', async () => {
    mockDepMaybeSingle.mockResolvedValue({ data: null, error: null })

    expect(await reactivateDepositorAction('dep-x')).toEqual({ error: 'Depositante não encontrado.' })
  })
})

describe('updateDepositorAction', () => {
  it('atualiza razao_social e retorna {ok:true}', async () => {
    const result = await updateDepositorAction({ id: 'dep-1', razao_social: 'Nova Razão Social' })

    expect(result).toEqual({ ok: true })
    expect(mockUpdate).toHaveBeenCalledWith({ razao_social: 'Nova Razão Social' })
    expect(mockEq).toHaveBeenCalledWith('id', 'dep-1')
  })

  it('revalida /admin/depositantes após atualização', async () => {
    const { revalidatePath } = await import('next/cache')

    await updateDepositorAction({ id: 'dep-1', razao_social: 'Razão Atualizada' })

    expect(revalidatePath).toHaveBeenCalledWith('/admin/depositantes')
  })

  it('retorna erro quando DB falha', async () => {
    mockEq.mockResolvedValue({ error: new Error('not found') })

    const result = await updateDepositorAction({ id: 'dep-xxx', razao_social: 'X' })

    expect(result).toEqual({ error: 'not found' })
  })
})
