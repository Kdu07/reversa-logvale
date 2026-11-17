import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { getOperatorHomeStatsAction, type OperatorHomeStats } from '@/app/(operator)/operador/actions'

const getCurrentUser = vi.fn()
vi.mock('@/lib/supabase/get-current-user', () => ({
  getCurrentUser: () => getCurrentUser(),
}))

// Cada `from()` gera um builder que registra os filtros aplicados; ao ser
// aguardado, `respond(calls)` decide o resultado a partir desses filtros —
// assim os testes não dependem da ordem em que a action monta as queries.
type Call = [string, unknown[]]
type Result = { data?: unknown; count?: number | null; error?: { message: string } | null }
let respond: (calls: Call[]) => Result
const builders: Call[][] = []

function builder() {
  const calls: Call[] = []
  builders.push(calls)
  const b: Record<string, unknown> = {}
  for (const m of ['select', 'eq', 'gte', 'gt', 'is', 'order', 'limit']) {
    b[m] = (...args: unknown[]) => { calls.push([m, args]); return b }
  }
  b.then = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
    Promise.resolve({ error: null, ...respond(calls) }).then(resolve, reject)
  return b
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({ from: () => builder() })),
}))

const has = (calls: Call[], method: string, col: string, val?: unknown) =>
  calls.some(([m, a]) => m === method && a[0] === col && (val === undefined || a[1] === val))

/** Respostas por "assinatura" de filtros — cobre todas as queries da action. */
function defaultRespond(calls: Call[]): Result {
  if (has(calls, 'order', 'decided_at')) {
    return {
      count: 9,
      data: [{
        id: 'r-1', rv: 'RV-1', decision: 'store_for_handling', decided_at: '2026-11-15T12:00:00Z',
        depositors: { razao_social: 'Acme' },
      }],
    }
  }
  if (has(calls, 'eq', 'decision')) {
    const d = calls.find(([m, a]) => m === 'eq' && a[0] === 'decision')![1][1]
    return { count: d === 'return_to_stock' ? 5 : d === 'reship' ? 4 : 0 }
  }
  if (has(calls, 'eq', 'status', 'decided')) return { count: 15 }   // total geral
  if (has(calls, 'eq', 'processed_by')) return { count: 6 }
  if (has(calls, 'eq', 'status', 'awaiting_decision')) {
    return { count: has(calls, 'is', 'access_key') ? 3 : 20 }
  }
  if (has(calls, 'eq', 'received_by')) {
    if (has(calls, 'gt', 'damaged_item_count')) return { count: 2 }
    if (has(calls, 'eq', 'item_count', 0))      return { count: 1 }
    const since = calls.find(([m, a]) => m === 'gte' && a[0] === 'received_at')![1][1]
    if (since === '2026-11-15T03:00:00.000Z') return { count: 4 }   // hoje
    if (since === '2026-11-01T03:00:00.000Z') return { count: 30 }  // mês
  }
  throw new Error(`query inesperada: ${JSON.stringify(calls)}`)
}

beforeEach(() => {
  vi.clearAllMocks()
  builders.length = 0
  // 01:30 UTC de 16/11 = 22:30 de 15/11 em São Paulo: "hoje" é dia 15.
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-11-16T01:30:00Z'))
  getCurrentUser.mockResolvedValue({
    id: 'op-1', email: 'op@test.com',
    profile: { id: 'op-1', role: 'operator', active: true, full_name: 'Op', phone: null, terms_accepted_at: null, created_at: '' },
  })
  respond = defaultRespond
})

afterEach(() => {
  vi.useRealTimers()
})

describe('getOperatorHomeStatsAction', () => {
  it('agrega produção, tratativas e aguardando cliente', async () => {
    const result = await getOperatorHomeStatsAction() as OperatorHomeStats

    expect(result.ranges).toEqual({ today: '2026-11-15', monthStart: '2026-11-01' })
    expect(result.mine).toEqual({ today: 4, month: 30, damagedMonth: 2, emptyMonth: 1 })
    expect(result.tratativas.pending).toBe(15)
    expect(result.tratativas.filteredPending).toBe(9)
    expect(result.tratativas.depositorId).toBeNull()
    expect(result.tratativas.processedTodayByMe).toBe(6)
    expect(result.tratativas.byDecision).toEqual({
      return_to_stock: 5, store_for_handling: 0, discard: 0, repackage: 0, reship: 4,
    })
    expect(result.awaiting).toEqual({ total: 20, withoutKey: 3 })
  })

  it('fecha os períodos no dia civil de São Paulo, não no fuso do servidor', async () => {
    await getOperatorHomeStatsAction()

    const processed = builders.find((c) => has(c, 'eq', 'processed_by'))!
    expect(has(processed, 'gte', 'processed_at', '2026-11-15T03:00:00.000Z')).toBe(true)
  })

  it('lista as tratativas decididas mais recentemente primeiro', async () => {
    const result = await getOperatorHomeStatsAction() as OperatorHomeStats

    const recent = builders.find((c) => has(c, 'order', 'decided_at'))!
    expect(recent).toContainEqual(['order', ['decided_at', { ascending: false }]])
    expect(recent).toContainEqual(['eq', ['status', 'decided']])
    expect(result.tratativas.recent[0]).toMatchObject({ id: 'r-1', rv: 'RV-1', depositorName: 'Acme' })
  })

  it('filtro de depositante vale só para o quadro de tratativas', async () => {
    const result = await getOperatorHomeStatsAction({ depositorId: 'dep-1' }) as OperatorHomeStats

    const withDep = builders.filter((c) => has(c, 'eq', 'depositor_id', 'dep-1'))
    // 5 contagens por decisão + a lista recente
    expect(withDep).toHaveLength(6)
    expect(withDep.every((c) => has(c, 'eq', 'status', 'decided'))).toBe(true)
    // total geral, produção e aguardando cliente não são filtrados
    const total = builders.find((c) =>
      has(c, 'eq', 'status', 'decided') && !has(c, 'eq', 'decision') && !has(c, 'order', 'decided_at'))!
    expect(has(total, 'eq', 'depositor_id')).toBe(false)
    expect(builders.filter((c) => has(c, 'eq', 'received_by')).some((c) => has(c, 'eq', 'depositor_id'))).toBe(false)
    expect(result.tratativas.depositorId).toBe('dep-1')
    expect(result.tratativas.pending).toBe(15)
  })

  it('lê o depositante tanto como objeto quanto como array', async () => {
    respond = (calls) => has(calls, 'order', 'decided_at')
      ? { count: 1, data: [{ id: 'r-2', rv: 'RV-2', decision: 'discard', decided_at: '2026-11-15', depositors: [{ razao_social: 'Beta' }] }] }
      : defaultRespond(calls)

    const result = await getOperatorHomeStatsAction() as OperatorHomeStats

    expect(result.tratativas.recent[0].depositorName).toBe('Beta')
  })

  it('usa null quando o depositante não está presente', async () => {
    respond = (calls) => has(calls, 'order', 'decided_at')
      ? { count: 1, data: [{ id: 'r-2', rv: 'RV-2', decision: 'discard', decided_at: '2026-11-15', depositors: null }] }
      : defaultRespond(calls)

    const result = await getOperatorHomeStatsAction() as OperatorHomeStats

    expect(result.tratativas.recent[0].depositorName).toBeNull()
  })

  it('contagem nula vira zero', async () => {
    respond = (calls) => has(calls, 'eq', 'processed_by') ? { count: null } : defaultRespond(calls)

    const result = await getOperatorHomeStatsAction() as OperatorHomeStats

    expect(result.tratativas.processedTodayByMe).toBe(0)
  })

  it('propaga erro de qualquer contagem', async () => {
    respond = (calls) => has(calls, 'is', 'access_key')
      ? { count: null, error: { message: 'rls denied' } }
      : defaultRespond(calls)

    expect(await getOperatorHomeStatsAction()).toEqual({ error: 'rls denied' })
  })

  it('propaga erro da lista de tratativas', async () => {
    respond = (calls) => has(calls, 'order', 'decided_at')
      ? { data: null, count: null, error: { message: 'timeout' } }
      : defaultRespond(calls)

    expect(await getOperatorHomeStatsAction()).toEqual({ error: 'timeout' })
  })

  it('retorna erro quando getCurrentUser lança', async () => {
    getCurrentUser.mockRejectedValue(new Error('not authenticated'))

    const result = await getOperatorHomeStatsAction()

    expect(result).toEqual({ error: 'not authenticated' })
  })
})
