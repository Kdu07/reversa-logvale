import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getTrativasAction, getTrativaDepositorsAction } from '@/app/(operator)/operador/tratativas/actions'

// ── auth ─────────────────────────────────────────────────────────────
const getCurrentUser = vi.fn()
vi.mock('@/lib/supabase/get-current-user', () => ({
  getCurrentUser: () => getCurrentUser(),
}))

const isSuperUser = vi.fn()
vi.mock('@/lib/auth/super', () => ({ isSuperUser: (u: unknown) => isSuperUser(u) }))

// signed URLs: echo back `signed:<path>` so we can assert the mapping
vi.mock('@/lib/supabase/storage', () => ({
  buildSignedUrlMap: vi.fn((_c: unknown, _bucket: string, paths: string[]) =>
    Promise.resolve(new Map(paths.map((p) => [p, `signed:${p}`]))),
  ),
}))

// ── Supabase server client (thenable builder) ────────────────────────
type ReturnsResult = { data: unknown; count?: number; error: unknown }
let returnsResult: ReturnsResult
/** Respostas por chamada (lotes paginados); vazia = usa `returnsResult`. */
let returnsQueue: ReturnsResult[] = []
const ilikeCalls: unknown[][] = []
const eqCalls:    unknown[][] = []
const orderCalls: unknown[][] = []
const rangeCalls: unknown[][] = []

function builder() {
  const b: Record<string, unknown> = {}
  const chain = () => b
  for (const m of ['select', 'not']) b[m] = vi.fn(chain)
  b.range = vi.fn((...args: unknown[]) => { rangeCalls.push(args); return b })
  b.eq    = vi.fn((...args: unknown[]) => { eqCalls.push(args);    return b })
  b.order = vi.fn((...args: unknown[]) => { orderCalls.push(args); return b })
  b.ilike = vi.fn((col: string, val: unknown) => { ilikeCalls.push([col, val]); return b })
  b.then = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
    Promise.resolve(returnsQueue.length > 0 ? returnsQueue.shift() : returnsResult).then(resolve, reject)
  return b
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({ from: () => builder() })),
}))

function asOperator() {
  getCurrentUser.mockResolvedValue({
    id: 'op-1', email: 'op@test.com',
    profile: { id: 'op-1', role: 'operator', active: true, full_name: 'Op', phone: null, terms_accepted_at: null, created_at: '' },
  })
  isSuperUser.mockReturnValue(false)
}

beforeEach(() => {
  vi.clearAllMocks()
  ilikeCalls.length = 0
  eqCalls.length    = 0
  orderCalls.length = 0
  rangeCalls.length = 0
  returnsQueue      = []
  asOperator()
  returnsResult = { data: [], count: 0, error: null }
})

describe('getTrativasAction', () => {
  it('nega acesso a quem não é operator nem super', async () => {
    getCurrentUser.mockResolvedValue({
      id: 'c-1', email: 'c@test.com',
      profile: { id: 'c-1', role: 'client', active: true, full_name: 'C', phone: null, terms_accepted_at: null, created_at: '' },
    })

    const result = await getTrativasAction()

    expect(result).toEqual({ error: 'Acesso negado' })
  })

  it('mapeia fotos (ordenadas por position) e dados do depositante/cliente', async () => {
    returnsResult = {
      data: [{
        id: 'r-1', rv: 'RV-1', identifier_type: 'access_key', access_key: '4'.repeat(44),
        postal_code: null, illegible_token: null, item_count: 2, damaged_item_count: 0,
        received_at: '2025-01-01', decided_at: '2025-01-02', decided_by_type: 'client',
        decision: 'discard', depositor_id: 'dep-1', return_invoice_xml_url: 'xml/ret.xml',
        depositors: { razao_social: 'Acme Ltda' },
        profiles:   { full_name: 'Cliente Fulano' },
        return_photos: [
          { storage_path: 'box/b.jpg',  photo_type: 'box',  position: 1 },
          { storage_path: 'box/a.jpg',  photo_type: 'box',  position: 0 },
          { storage_path: 'item/i.jpg', photo_type: 'item', position: 0 },
        ],
      }],
      count: 1, error: null,
    }

    const result = await getTrativasAction()

    expect(result).not.toHaveProperty('error')
    const ok = result as unknown as { rows: Record<string, unknown>[]; total: number }
    expect(ok.total).toBe(1)
    expect(ok.rows[0]).toMatchObject({
      id: 'r-1', depositorName: 'Acme Ltda', clientName: 'Cliente Fulano',
      itemCount: 2, damagedItemCount: 0,
      returnInvoiceXmlPath: 'xml/ret.xml',
      boxPhotoUrls:  ['signed:box/a.jpg', 'signed:box/b.jpg'], // ordenado por position
      itemPhotoUrls: ['signed:item/i.jpg'],
    })
  })

  it('clientName é null quando a decisão foi automática', async () => {
    returnsResult = {
      data: [{
        id: 'r-2', rv: 'RV-2', identifier_type: 'access_key', access_key: null,
        postal_code: null, illegible_token: null, item_count: 1,
        received_at: '2025-01-01', decided_at: '2025-01-02', decided_by_type: 'auto',
        decision: 'discard', depositor_id: 'dep-1',
        depositors: { razao_social: 'Acme' }, profiles: { full_name: 'Ignorado' },
        return_photos: [],
      }],
      count: 1, error: null,
    }

    const result = await getTrativasAction()

    const ok = result as { rows: { clientName: string | null }[] }
    expect(ok.rows[0].clientName).toBeNull()
  })

  it('aplica filtro de RV via ilike', async () => {
    await getTrativasAction({ rv: 'RV-7' })

    expect(ilikeCalls).toContainEqual(['rv', '%RV-7%'])
  })

  it('lista as decididas mais recentemente primeiro', async () => {
    await getTrativasAction()

    expect(orderCalls).toEqual([['decided_at', { ascending: false }]])
  })

  it('aplica filtro de decisão', async () => {
    await getTrativasAction({ decision: 'reship' })

    expect(eqCalls).toContainEqual(['status', 'decided'])
    expect(eqCalls).toContainEqual(['decision', 'reship'])
  })

  it('aplica filtro de depositante', async () => {
    await getTrativasAction({ depositorId: 'dep-1' })

    expect(eqCalls).toContainEqual(['depositor_id', 'dep-1'])
  })

  it('sem filtro de decisão não restringe a decisão', async () => {
    await getTrativasAction()

    expect(eqCalls).toEqual([['status', 'decided']])
  })

  it('propaga erro do banco', async () => {
    returnsResult = { data: null, count: 0, error: { message: 'rls denied' } }

    const result = await getTrativasAction()

    expect(result).toEqual({ error: 'rls denied' })
  })

  it('super user tem acesso', async () => {
    getCurrentUser.mockResolvedValue({
      id: 's-1', email: 'super@logvale.com',
      profile: { id: 's-1', role: 'manager', active: true, full_name: 'Super', phone: null, terms_accepted_at: null, created_at: '' },
    })
    isSuperUser.mockReturnValue(true)

    const result = await getTrativasAction()

    expect(result).not.toHaveProperty('error')
  })
})

describe('getTrativaDepositorsAction', () => {
  it('agrupa por depositante com a contagem e ordena por nome', async () => {
    returnsResult = {
      data: [
        { depositor_id: 'd-2', depositors: { razao_social: 'Zeta' } },
        { depositor_id: 'd-1', depositors: { razao_social: 'Acme' } },
        { depositor_id: 'd-2', depositors: { razao_social: 'Zeta' } },
        { depositor_id: null,  depositors: null },
      ],
      error: null,
    }

    const result = await getTrativaDepositorsAction()

    expect(result).toEqual([
      { id: 'd-1', name: 'Acme', count: 1 },
      { id: 'd-2', name: 'Zeta', count: 2 },
    ])
    expect(eqCalls).toContainEqual(['status', 'decided'])
  })

  it('lê em lotes de 1000 até um lote incompleto (sem truncar no limite do PostgREST)', async () => {
    const full = Array.from({ length: 1000 }, () => ({ depositor_id: 'd-1', depositors: { razao_social: 'Acme' } }))
    returnsQueue = [
      { data: full, error: null },
      { data: [
        { depositor_id: 'd-1', depositors: { razao_social: 'Acme' } },
        { depositor_id: 'd-2', depositors: { razao_social: 'Zeta' } },
      ], error: null },
    ]

    const result = await getTrativaDepositorsAction()

    expect(result).toEqual([
      { id: 'd-1', name: 'Acme', count: 1001 },
      { id: 'd-2', name: 'Zeta', count: 1 },
    ])
    expect(rangeCalls).toEqual([[0, 999], [1000, 1999]])
    expect(orderCalls).toContainEqual(['id', { ascending: true }])
  })

  it('devolve lista vazia com erro do banco', async () => {
    returnsResult = { data: null, error: { message: 'x' } }
    expect(await getTrativaDepositorsAction()).toEqual([])
  })

  it('devolve lista vazia para quem não é operador nem super', async () => {
    getCurrentUser.mockResolvedValue({
      id: 'c-1', email: 'c@test.com',
      profile: { id: 'c-1', role: 'client', active: true, full_name: 'C', phone: null, terms_accepted_at: null, created_at: '' },
    })
    expect(await getTrativaDepositorsAction()).toEqual([])
  })
})
