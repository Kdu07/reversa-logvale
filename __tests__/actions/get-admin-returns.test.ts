import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getAdminReturnsAction } from '@/app/(manager)/admin/devolucoes/actions'

// ── assertManager → getCurrentUser ───────────────────────────────────
const getCurrentUser = vi.fn()
vi.mock('@/lib/supabase/get-current-user', () => ({
  getCurrentUser: () => getCurrentUser(),
}))
vi.mock('@/lib/auth/super', () => ({ isSuperUser: vi.fn().mockReturnValue(false) }))
vi.mock('@/lib/integrations/nfeio', () => ({ persistInvoiceFiles: vi.fn() }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }))

vi.mock('@/lib/supabase/storage', () => ({
  buildSignedUrlMap: vi.fn((_c: unknown, _bucket: string, paths: string[]) =>
    Promise.resolve(new Map(paths.map((p) => [p, `signed:${p}`]))),
  ),
}))

// ── Supabase server client (thenable builder) ────────────────────────
let returnsResult: { data: unknown; count?: number; error: unknown }
const ilikeCalls: unknown[][] = []
const eqCalls:    unknown[][] = []

function builder() {
  const b: Record<string, unknown> = {}
  const chain = () => b
  for (const m of ['select', 'order', 'range']) b[m] = vi.fn(chain)
  b.ilike = vi.fn((c: string, v: unknown) => { ilikeCalls.push([c, v]); return b })
  b.eq    = vi.fn((c: string, v: unknown) => { eqCalls.push([c, v]); return b })
  b.then  = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
    Promise.resolve(returnsResult).then(resolve, reject)
  return b
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({ from: () => builder() })),
}))

function asManager() {
  getCurrentUser.mockResolvedValue({
    id: 'm-1', email: 'm@logvale.com',
    profile: { id: 'm-1', role: 'manager', active: true, full_name: 'M', phone: null, terms_accepted_at: '2024-01-01', created_at: '' },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  ilikeCalls.length = 0
  eqCalls.length = 0
  asManager()
  returnsResult = { data: [], count: 0, error: null }
})

describe('getAdminReturnsAction', () => {
  it('mapeia linhas com fotos, depositante e operador', async () => {
    returnsResult = {
      data: [{
        id: 'r-1', rv: 'RV-1', status: 'decided', decision: 'discard', decided_by_type: 'client',
        received_at: '2025-01-01', decided_at: '2025-01-02', processed_at: null,
        identifier_type: 'access_key', access_key: '4'.repeat(44), postal_code: null, illegible_token: null,
        item_count: 2, invoice_xml_url: 'xml/nf.xml', invoice_pdf_url: 'pdf/nf.pdf', return_invoice_xml_url: 'xml/ret.xml',
        depositors: { razao_social: 'Acme' }, profiles: { full_name: 'Operador X' },
        return_photos: [
          { photo_type: 'box',  storage_path: 'box/b.jpg',  position: 1 },
          { photo_type: 'box',  storage_path: 'box/a.jpg',  position: 0 },
          { photo_type: 'item', storage_path: 'item/i.jpg', position: 0 },
        ],
      }],
      count: 1, error: null,
    }

    const result = await getAdminReturnsAction()

    expect(result).not.toHaveProperty('error')
    const ok = result as unknown as { rows: Record<string, unknown>[]; total: number }
    expect(ok.total).toBe(1)
    expect(ok.rows[0]).toMatchObject({
      id: 'r-1', depositorName: 'Acme', operatorName: 'Operador X',
      // XMLs saem como path cru (assinados on-click pelo DownloadXmlButton), não como signed URL
      invoiceXmlPath:       'xml/nf.xml',
      invoicePdfPath:       'pdf/nf.pdf',
      returnInvoiceXmlPath: 'xml/ret.xml',
      boxPhotoUrls:  ['signed:box/a.jpg', 'signed:box/b.jpg'], // ordenado por position
      itemPhotoUrls: ['signed:item/i.jpg'],
    })
  })

  it('aplica filtros de rv e status', async () => {
    await getAdminReturnsAction({ rv: 'RV-9', status: 'processed' })

    expect(ilikeCalls).toContainEqual(['rv', '%RV-9%'])
    expect(eqCalls).toContainEqual(['status', 'processed'])
  })

  it('propaga erro do banco', async () => {
    returnsResult = { data: null, count: 0, error: new Error('db down') }

    const result = await getAdminReturnsAction()

    expect(result).toEqual({ error: 'db down' })
  })

  it('nega acesso a quem não é manager', async () => {
    getCurrentUser.mockResolvedValue({
      id: 'op-1', email: 'op@test.com',
      profile: { id: 'op-1', role: 'operator', active: true, full_name: 'Op', phone: null, terms_accepted_at: null, created_at: '' },
    })

    const result = await getAdminReturnsAction()

    expect(result).toEqual({ error: 'Acesso negado' })
  })
})
