import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  getClientReturnsAction,
  getClientHistoryAction,
  exportHistoryAction,
} from '@/app/(client)/cliente/actions'
import { buildSignedUrlMap } from '@/lib/supabase/storage'

// ── auth ─────────────────────────────────────────────────────────────
const getCurrentUser = vi.fn()
vi.mock('@/lib/supabase/get-current-user', () => ({
  getCurrentUser: () => getCurrentUser(),
}))

const isSuperUser = vi.fn()
vi.mock('@/lib/auth/super', () => ({ isSuperUser: (u: unknown) => isSuperUser(u) }))

// signed URLs are not the subject here — return empty maps (except where a test
// overrides it to exercise the photo mapping)
vi.mock('@/lib/supabase/storage', () => ({ buildSignedUrlMap: vi.fn() }))

// ── Supabase server client (thenable query builder) ──────────────────
let returnsResult:    { data: unknown; count?: number; error: unknown }
let cdResult:         { data: unknown; error?: unknown }
let depositorsResult: { data: unknown; error?: unknown }

function resultFor(table: string) {
  if (table === 'returns')           return returnsResult
  if (table === 'client_depositors') return cdResult
  if (table === 'depositors')        return depositorsResult
  return { data: null, error: null }
}

function builder(table: string) {
  const b: Record<string, unknown> = {}
  const chain = () => b
  for (const m of ['select', 'eq', 'neq', 'gte', 'lte', 'ilike', 'order', 'range']) {
    b[m] = vi.fn(chain)
  }
  b.then = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
    Promise.resolve(resultFor(table)).then(resolve, reject)
  return b
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({ from: (t: string) => builder(t) })),
}))

function asClient(id = 'client-1') {
  getCurrentUser.mockResolvedValue({
    id, email: 'cliente@test.com',
    profile: { id, role: 'client', active: true, full_name: 'Cliente', phone: null, terms_accepted_at: '2024-01-01', created_at: '' },
  })
  isSuperUser.mockReturnValue(false)
}

beforeEach(() => {
  vi.clearAllMocks()
  asClient()
  returnsResult    = { data: [], count: 0, error: null }
  cdResult         = { data: [], error: null }
  depositorsResult = { data: [], error: null }
  vi.mocked(buildSignedUrlMap).mockResolvedValue(new Map())
})

/** Devolução com duas fotos de caixa fora de ordem e uma de item. */
const RETURN_WITH_PHOTOS = {
  id: 'r-photos', identifier_type: 'logistics_code', access_key: null,
  postal_code: null, logistics_code: 'LR-42', illegible_token: null,
  rv: 'RV-PHOTOS', item_count: 2, received_at: '2025-01-01',
  depositor_id: 'dep-1', invoice_xml_url: null, invoice_pdf_url: null,
  final_customer_name: 'CLIENTE FINAL',
  decision: 'discard', decided_at: '2025-01-03', decided_by_type: 'auto',
  depositors: { razao_social: 'Acme' },
  return_photos: [
    { storage_path: 'box-2',  photo_type: 'box',  position: 2 },
    { storage_path: 'box-1',  photo_type: 'box',  position: 1 },
    { storage_path: 'item-1', photo_type: 'item', position: 1 },
    { storage_path: 'sem-url', photo_type: 'item', position: 2 },
  ],
}

const PHOTO_URLS = new Map([
  ['box-1', 'signed/box-1'],
  ['box-2', 'signed/box-2'],
  ['item-1', 'signed/item-1'],
])

// ─────────────────────────────────────────────────────────────────────
describe('getClientReturnsAction', () => {
  it('nega acesso a quem não é client nem super', async () => {
    getCurrentUser.mockResolvedValue({
      id: 'op-1', email: 'op@test.com',
      profile: { id: 'op-1', role: 'operator', active: true, full_name: 'Op', phone: null, terms_accepted_at: null, created_at: '' },
    })

    const result = await getClientReturnsAction()

    expect(result).toEqual({ error: 'Acesso negado' })
  })

  it('lista de depositantes do cliente vem escopada por client_depositors', async () => {
    cdResult = {
      data: [{ depositor_id: 'dep-1', depositors: { razao_social: 'Acme Ltda' } }],
      error: null,
    }
    returnsResult = {
      data: [{
        id: 'r-1', identifier_type: 'access_key', access_key: '4'.repeat(44),
        postal_code: null, illegible_token: null, rv: 'RV-1', item_count: 2,
        received_at: '2025-01-01', depositor_id: 'dep-1', invoice_xml_url: null,
        depositors: { razao_social: 'Acme Ltda' }, return_photos: [],
      }],
      count: 1, error: null,
    }

    const result = await getClientReturnsAction()

    expect(result).not.toHaveProperty('error')
    const ok = result as { rows: unknown[]; total: number; depositors: { id: string; name: string }[] }
    expect(ok.total).toBe(1)
    expect(ok.depositors).toEqual([{ id: 'dep-1', name: 'Acme Ltda' }])
    expect(ok.rows[0]).toMatchObject({ id: 'r-1', depositorName: 'Acme Ltda' })
  })

  it('super user recebe todos os depositantes ativos', async () => {
    isSuperUser.mockReturnValue(true)
    depositorsResult = {
      data: [{ id: 'dep-1', razao_social: 'Acme' }, { id: 'dep-2', razao_social: 'Beta' }],
      error: null,
    }

    const result = await getClientReturnsAction()

    const ok = result as { depositors: { id: string; name: string }[] }
    expect(ok.depositors).toEqual([
      { id: 'dep-1', name: 'Acme' },
      { id: 'dep-2', name: 'Beta' },
    ])
  })

  it('aplica filtros de depositante e período', async () => {
    const filterCalls: Record<string, unknown[]> = {}
    vi.mocked((await import('@/lib/supabase/server')).createClient).mockReturnValueOnce({
      from: () => {
        const b: Record<string, unknown> = {}
        const chain = () => b
        b.select = vi.fn(chain)
        b.order  = vi.fn(chain)
        b.range  = vi.fn(chain)
        b.eq  = vi.fn((col: string, val: unknown) => { (filterCalls.eq  ??= []).push([col, val]); return b })
        b.gte = vi.fn((col: string, val: unknown) => { (filterCalls.gte ??= []).push([col, val]); return b })
        b.lte = vi.fn((col: string, val: unknown) => { (filterCalls.lte ??= []).push([col, val]); return b })
        b.then = (resolve: (v: unknown) => unknown) => Promise.resolve({ data: [], count: 0, error: null }).then(resolve)
        return b
      },
    } as never)

    await getClientReturnsAction({ depositorId: 'dep-9', from: '2025-01-01', to: '2025-02-01' })

    expect(filterCalls.eq).toContainEqual(['depositor_id', 'dep-9'])
    expect(filterCalls.gte).toContainEqual(['received_at', '2025-01-01'])
    expect(filterCalls.lte).toContainEqual(['received_at', '2025-02-01'])
  })

  it('propaga erro do banco', async () => {
    returnsResult = { data: null, count: 0, error: { message: 'rls denied' } }

    const result = await getClientReturnsAction()

    expect(result).toEqual({ error: 'rls denied' })
  })

  it('assina as fotos separando caixa de item e ordenando por position', async () => {
    returnsResult = { data: [RETURN_WITH_PHOTOS], count: 1, error: null }
    vi.mocked(buildSignedUrlMap).mockResolvedValue(PHOTO_URLS)

    const result = await getClientReturnsAction()

    const ok = result as unknown as { rows: Record<string, unknown>[] }
    expect(ok.rows[0].boxPhotoUrls).toEqual(['signed/box-1', 'signed/box-2'])
    // 'sem-url' não tem URL assinada e é descartada
    expect(ok.rows[0].itemPhotoUrls).toEqual(['signed/item-1'])
    expect(ok.rows[0].finalCustomerName).toBe('CLIENTE FINAL')
    // pendentes ainda não têm decisão nem XML de devolução
    expect(ok.rows[0].decision).toBeNull()
    expect(ok.rows[0].returnInvoiceXmlPath).toBeNull()
  })

  it('devolve mensagem de erro quando a sessão falha', async () => {
    getCurrentUser.mockRejectedValue(new Error('sessão expirada'))
    expect(await getClientReturnsAction()).toEqual({ error: 'sessão expirada' })
  })

  it('devolve erro genérico quando a exceção não é Error', async () => {
    getCurrentUser.mockRejectedValue('falha crua')
    expect(await getClientReturnsAction()).toEqual({ error: 'Erro interno' })
  })
})

// ─────────────────────────────────────────────────────────────────────
describe('getClientHistoryAction', () => {
  it('mapeia campos de decisão dos returns "decided"', async () => {
    returnsResult = {
      data: [{
        id: 'r-9', identifier_type: 'postal_code', access_key: null,
        postal_code: '01234-567', illegible_token: null, rv: 'RV-9', item_count: 1,
        received_at: '2025-01-01', depositor_id: 'dep-1', invoice_xml_url: null,
        decision: 'return_to_stock', decided_at: '2025-01-03', decided_by_type: 'client',
        depositors: { razao_social: 'Acme' }, return_photos: [],
      }],
      count: 1, error: null,
    }

    const result = await getClientHistoryAction()

    const ok = result as unknown as { rows: Record<string, unknown>[] }
    expect(ok.rows[0]).toMatchObject({
      id: 'r-9', decision: 'return_to_stock', decidedByType: 'client', decidedAt: '2025-01-03',
    })
  })

  it('nega acesso a quem não é client nem super', async () => {
    getCurrentUser.mockResolvedValue({
      id: 'op-1', email: 'op@test.com',
      profile: { id: 'op-1', role: 'operator', active: true, full_name: 'Op', phone: null, terms_accepted_at: null, created_at: '' },
    })

    const result = await getClientHistoryAction()

    expect(result).toEqual({ error: 'Acesso negado' })
  })

  it('assina as fotos e expõe o XML da NF de devolução', async () => {
    returnsResult = {
      data: [{ ...RETURN_WITH_PHOTOS, return_invoice_xml_url: 'returns/r-photos.xml' }],
      count: 1, error: null,
    }
    vi.mocked(buildSignedUrlMap).mockResolvedValue(PHOTO_URLS)

    const result = await getClientHistoryAction()

    const ok = result as unknown as { rows: Record<string, unknown>[] }
    expect(ok.rows[0].boxPhotoUrls).toEqual(['signed/box-1', 'signed/box-2'])
    expect(ok.rows[0].returnInvoiceXmlPath).toBe('returns/r-photos.xml')
    expect(ok.rows[0].decidedByType).toBe('auto')
  })

  it('super user recebe todos os depositantes ativos', async () => {
    isSuperUser.mockReturnValue(true)
    depositorsResult = { data: [{ id: 'dep-1', razao_social: 'Acme' }], error: null }

    const result = await getClientHistoryAction()

    const ok = result as { depositors: { id: string; name: string }[] }
    expect(ok.depositors).toEqual([{ id: 'dep-1', name: 'Acme' }])
  })

  it('propaga erro do banco', async () => {
    returnsResult = { data: null, count: 0, error: { message: 'rls denied' } }
    expect(await getClientHistoryAction()).toEqual({ error: 'rls denied' })
  })

  it('devolve mensagem de erro quando a sessão falha', async () => {
    getCurrentUser.mockRejectedValue(new Error('sessão expirada'))
    expect(await getClientHistoryAction()).toEqual({ error: 'sessão expirada' })
  })
})

// ─────────────────────────────────────────────────────────────────────
describe('exportHistoryAction (isolamento de dados)', () => {
  const RETURNS = [
    { id: 'r-own',   identifier_type: 'access_key', access_key: '1'.repeat(44), postal_code: null, illegible_token: null, rv: 'RV-OWN',   item_count: 1, received_at: '2025-01-01', depositor_id: 'dep-allowed', decision: 'discard',         decided_at: '2025-01-02', decided_by_type: 'client', status: 'decided', depositors: { razao_social: 'Minha Empresa' } },
    { id: 'r-other', identifier_type: 'access_key', access_key: '2'.repeat(44), postal_code: null, illegible_token: null, rv: 'RV-OTHER', item_count: 1, received_at: '2025-01-01', depositor_id: 'dep-foreign', decision: 'return_to_stock', decided_at: '2025-01-02', decided_by_type: 'auto',   status: 'decided', depositors: { razao_social: 'Empresa Alheia' } },
  ]

  it('exclui devoluções de depositantes fora do escopo do cliente', async () => {
    returnsResult = { data: RETURNS, error: null }
    cdResult      = { data: [{ depositor_id: 'dep-allowed' }], error: null }

    const result = await exportHistoryAction()

    expect(result).not.toHaveProperty('error')
    const ok = result as { base64: string; filename: string }
    expect(ok.filename).toBe(`historico-devolucoes-${new Date().toISOString().slice(0, 10)}.xlsx`)

    const XLSX  = await import('xlsx')
    const wb    = XLSX.read(Buffer.from(ok.base64, 'base64'), { type: 'buffer' })
    const sheet = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[wb.SheetNames[0]])
    const rvs   = sheet.map((r) => r['RV'])

    expect(rvs).toContain('RV-OWN')
    expect(rvs).not.toContain('RV-OTHER') // depositante alheio filtrado
  })

  it('super user recebe todas as devoluções (bypass do filtro)', async () => {
    isSuperUser.mockReturnValue(true)
    returnsResult = { data: RETURNS, error: null }
    cdResult      = { data: [], error: null } // nenhum vínculo, mas super ignora

    const result = await exportHistoryAction()

    const ok    = result as { base64: string }
    const XLSX  = await import('xlsx')
    const wb    = XLSX.read(Buffer.from(ok.base64, 'base64'), { type: 'buffer' })
    const sheet = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[wb.SheetNames[0]])
    const rvs   = sheet.map((r) => r['RV'])

    expect(rvs).toEqual(expect.arrayContaining(['RV-OWN', 'RV-OTHER']))
  })

  it('nega acesso a quem não é client nem super', async () => {
    getCurrentUser.mockResolvedValue({
      id: 'op-1', email: 'op@test.com',
      profile: { id: 'op-1', role: 'operator', active: true, full_name: 'Op', phone: null, terms_accepted_at: null, created_at: '' },
    })

    const result = await exportHistoryAction()

    expect(result).toEqual({ error: 'Acesso negado' })
  })

  it('propaga erro do banco', async () => {
    returnsResult = { data: null, error: { message: 'query failed' } }

    const result = await exportHistoryAction()

    expect(result).toEqual({ error: 'query failed' })
  })

  it('traduz identificador, decisão e origem para a planilha', async () => {
    returnsResult = {
      data: [{
        id: 'r-log', identifier_type: 'logistics_code', access_key: null,
        postal_code: null, logistics_code: 'LR-42', illegible_token: null,
        rv: 'RV-LOG', item_count: 3, received_at: '2025-01-01',
        depositor_id: 'dep-allowed', decision: 'store_for_handling',
        decided_at: '2025-01-02', decided_by_type: 'auto', status: 'decided',
        final_customer_name: 'CLIENTE FINAL', depositors: { razao_social: 'Acme' },
      }],
      error: null,
    }
    cdResult = { data: [{ depositor_id: 'dep-allowed' }], error: null }

    const result = await exportHistoryAction()

    const ok    = result as { base64: string }
    const XLSX  = await import('xlsx')
    const wb    = XLSX.read(Buffer.from(ok.base64, 'base64'), { type: 'buffer' })
    const sheet = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[wb.SheetNames[0]])

    expect(sheet[0]).toMatchObject({
      'RV':                 'RV-LOG',
      'Tipo Identificador': 'Código de Logística Reversa',
      'Identificador':      'Cód. Logística Reversa: LR-42',
      'Decisão':            'Tratativa',
      'Decidido por':       'Automático',
      'Cliente Final':      'CLIENTE FINAL',
    })
  })

  it('preenche com travessão os campos ausentes', async () => {
    returnsResult = {
      data: [{
        id: 'r-min', identifier_type: 'illegible', access_key: null,
        postal_code: null, logistics_code: null, illegible_token: 'ILG-1',
        rv: 'RV-MIN', item_count: 1, received_at: '2025-01-01',
        depositor_id: 'dep-allowed', decision: null, decided_at: null,
        decided_by_type: null, status: 'processed',
        final_customer_name: null, depositors: null,
      }],
      error: null,
    }
    cdResult = { data: [{ depositor_id: 'dep-allowed' }], error: null }

    const result = await exportHistoryAction()

    const ok    = result as { base64: string }
    const XLSX  = await import('xlsx')
    const wb    = XLSX.read(Buffer.from(ok.base64, 'base64'), { type: 'buffer' })
    const sheet = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[wb.SheetNames[0]])

    expect(sheet[0]).toMatchObject({
      'Depositante':   '—',
      'Cliente Final': '—',
      'Decisão':       '—',
      'Decidido por':  '—',
      'Data Decisão':  '—',
    })
  })

  it('devolve mensagem de erro quando a sessão falha', async () => {
    getCurrentUser.mockRejectedValue(new Error('sessão expirada'))
    expect(await exportHistoryAction()).toEqual({ error: 'sessão expirada' })
  })
})
