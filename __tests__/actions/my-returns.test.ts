import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  getMyReturnsAction,
  getMyReturnDepositorsAction,
} from '@/app/(operator)/operador/minhas-devolucoes/actions'
import { buildSignedUrlMap } from '@/lib/supabase/storage'

const currentUser = {
  id: 'op-1', email: 'operador@logvale.com', profile: { role: 'operator' },
}
const getCurrentUserMock = vi.fn(() => Promise.resolve(currentUser))
vi.mock('@/lib/supabase/get-current-user', () => ({
  getCurrentUser: () => getCurrentUserMock(),
}))

const isSuperUser = vi.fn().mockReturnValue(false)
vi.mock('@/lib/auth/super', () => ({ isSuperUser: (u: unknown) => isSuperUser(u) }))

vi.mock('@/lib/supabase/storage', () => ({ buildSignedUrlMap: vi.fn() }))

// Query builder encadeável: todo método devolve o próprio builder e registra a
// chamada, para os testes assertarem quais filtros a action aplicou. O objeto é
// thenable, então `await query` entrega `queryResult`.
type Call = [string, unknown[]]
let calls: Call[] = []
let queryResult: { data: unknown; count?: number | null; error: unknown } = {
  data: [], count: 0, error: null,
}

function makeQueryBuilder() {
  const builder: Record<string, unknown> = {}
  for (const method of ['select', 'eq', 'order', 'range', 'ilike', 'gte', 'lte', 'not']) {
    builder[method] = (...args: unknown[]) => {
      calls.push([method, args])
      return builder
    }
  }
  builder.then = (
    onFulfilled: (v: unknown) => unknown,
    onRejected?: (e: unknown) => unknown,
  ) => Promise.resolve(queryResult).then(onFulfilled, onRejected)
  return builder
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({ from: () => makeQueryBuilder() })),
}))

/** Argumentos da primeira chamada de `method`, ou undefined se não foi chamado. */
function argsOf(method: string): unknown[] | undefined {
  return calls.find(([m]) => m === method)?.[1]
}

function allArgsOf(method: string): unknown[][] {
  return calls.filter(([m]) => m === method).map(([, a]) => a)
}

const RETURN_ROW = {
  id: 'r-1', rv: 'RV2024001', status: 'decided', decision: 'return_to_stock',
  decided_by_type: 'client', received_at: '2026-07-20T10:00:00Z',
  decided_at: '2026-07-21T10:00:00Z', processed_at: null,
  identifier_type: 'access_key', access_key: '3'.repeat(44),
  postal_code: null, logistics_code: null, illegible_token: null, item_count: 2,
  invoice_xml_url: 'ak/x.xml', invoice_pdf_url: 'ak/x.pdf',
  return_invoice_xml_url: 'returns/r-1.xml', final_customer_name: 'CLIENTE FINAL',
  depositors: { razao_social: 'ACME LTDA' },
  return_photos: [
    { photo_type: 'box',  storage_path: 'b2', position: 2 },
    { photo_type: 'box',  storage_path: 'b1', position: 1 },
    { photo_type: 'item', storage_path: 'i1', position: 1 },
  ],
}

beforeEach(() => {
  vi.clearAllMocks()
  calls = []
  isSuperUser.mockReturnValue(false)
  currentUser.profile.role = 'operator'
  getCurrentUserMock.mockImplementation(() => Promise.resolve(currentUser))
  queryResult = { data: [], count: 0, error: null }
  vi.mocked(buildSignedUrlMap).mockResolvedValue(new Map())
})

describe('getMyReturnsAction', () => {
  it('nega acesso a quem não é operador nem super', async () => {
    currentUser.profile.role = 'client'
    expect(await getMyReturnsAction()).toEqual({ error: 'Acesso negado' })
  })

  it('permite super mesmo sem role de operador', async () => {
    currentUser.profile.role = 'manager'
    isSuperUser.mockReturnValue(true)
    const result = await getMyReturnsAction()
    expect(result).toEqual({ rows: [], total: 0 })
  })

  it('filtra pelas devoluções recebidas pelo próprio operador', async () => {
    await getMyReturnsAction()
    expect(argsOf('eq')).toEqual(['received_by', 'op-1'])
  })

  it('mapeia a devolução com fotos ordenadas por position', async () => {
    queryResult = { data: [RETURN_ROW], count: 1, error: null }
    vi.mocked(buildSignedUrlMap).mockImplementation(async (_c, bucket, paths) =>
      new Map(paths.map((p) => [p, `${bucket}/${p}`])),
    )

    const result = await getMyReturnsAction()

    if ('error' in result) throw new Error(result.error)
    expect(result.total).toBe(1)
    expect(result.rows[0]).toMatchObject({
      rv: 'RV2024001', depositorName: 'ACME LTDA', finalCustomerName: 'CLIENTE FINAL',
      invoiceXmlPath: 'ak/x.xml', invoicePdfPath: 'ak/x.pdf',
      returnInvoiceXmlPath: 'returns/r-1.xml', itemCount: 2,
    })
    // b1 (position 1) antes de b2 (position 2)
    expect(result.rows[0].boxPhotoUrls).toEqual(['box-photos/b1', 'box-photos/b2'])
    expect(result.rows[0].itemPhotoUrls).toEqual(['item-photos/i1'])
  })

  it('descarta fotos sem URL assinada', async () => {
    queryResult = { data: [RETURN_ROW], count: 1, error: null }
    vi.mocked(buildSignedUrlMap).mockResolvedValue(new Map([['b1', 'url-b1']]))

    const result = await getMyReturnsAction()

    if ('error' in result) throw new Error(result.error)
    expect(result.rows[0].boxPhotoUrls).toEqual(['url-b1'])
    expect(result.rows[0].itemPhotoUrls).toEqual([])
  })

  it('trata devolução sem depositante e sem fotos', async () => {
    queryResult = {
      data: [{ ...RETURN_ROW, depositors: null, return_photos: null, final_customer_name: null }],
      count: 1, error: null,
    }

    const result = await getMyReturnsAction()

    if ('error' in result) throw new Error(result.error)
    expect(result.rows[0].depositorName).toBeNull()
    expect(result.rows[0].finalCustomerName).toBeNull()
    expect(result.rows[0].boxPhotoUrls).toEqual([])
  })

  it('busca RV por correspondência parcial', async () => {
    await getMyReturnsAction({ rv: '2024001' })
    expect(argsOf('ilike')).toEqual(['rv', '%2024001%'])
  })

  it('filtra por depositante', async () => {
    await getMyReturnsAction({ depositorId: 'd-1' })
    expect(allArgsOf('eq')).toContainEqual(['depositor_id', 'd-1'])
  })

  it('converte o período para o início e o fim do dia local', async () => {
    await getMyReturnsAction({ from: '2026-07-01', to: '2026-07-31' })

    expect(argsOf('gte')).toEqual([
      'received_at', new Date('2026-07-01T00:00:00.000').toISOString(),
    ])
    expect(argsOf('lte')).toEqual([
      'received_at', new Date('2026-07-31T23:59:59.999').toISOString(),
    ])
  })

  it('ignora datas inválidas em vez de gerar filtro quebrado', async () => {
    await getMyReturnsAction({ from: 'não-é-data', to: '31/07/2026' })
    expect(argsOf('gte')).toBeUndefined()
    expect(argsOf('lte')).toBeUndefined()
  })

  it('pagina em blocos de 50', async () => {
    await getMyReturnsAction({ page: 3 })
    expect(argsOf('range')).toEqual([100, 149])
  })

  it('trata página inválida como a primeira', async () => {
    await getMyReturnsAction({ page: 0 })
    expect(argsOf('range')).toEqual([0, 49])
  })

  it('propaga erro da query', async () => {
    queryResult = { data: null, count: null, error: { message: 'timeout' } }
    expect(await getMyReturnsAction()).toEqual({ error: 'timeout' })
  })

  it('devolve total 0 quando a contagem vem nula', async () => {
    queryResult = { data: null, count: null, error: null }
    expect(await getMyReturnsAction()).toEqual({ rows: [], total: 0 })
  })

  it('devolve mensagem de erro quando a sessão falha', async () => {
    getCurrentUserMock.mockRejectedValue(new Error('sessão expirada'))
    expect(await getMyReturnsAction()).toEqual({ error: 'sessão expirada' })
  })

  it('devolve erro genérico quando a exceção não é Error', async () => {
    getCurrentUserMock.mockRejectedValue('falha crua')
    expect(await getMyReturnsAction()).toEqual({ error: 'Erro interno' })
  })
})

describe('getMyReturnDepositorsAction', () => {
  it('devolve lista vazia para quem não é operador nem super', async () => {
    currentUser.profile.role = 'client'
    expect(await getMyReturnDepositorsAction()).toEqual([])
  })

  it('deduplica depositantes e ordena por nome', async () => {
    queryResult = {
      data: [
        { depositor_id: 'd-2', depositors: { razao_social: 'Zeta Comércio' } },
        { depositor_id: 'd-1', depositors: { razao_social: 'Ácido Ltda' } },
        { depositor_id: 'd-2', depositors: { razao_social: 'Zeta Comércio' } },
        { depositor_id: 'd-3', depositors: { razao_social: 'Beta S.A.' } },
      ],
      error: null,
    }

    const result = await getMyReturnDepositorsAction()

    // localeCompare pt-BR ordena "Ácido" antes de "Beta"
    expect(result).toEqual([
      { id: 'd-1', name: 'Ácido Ltda' },
      { id: 'd-3', name: 'Beta S.A.' },
      { id: 'd-2', name: 'Zeta Comércio' },
    ])
  })

  it('ignora linhas sem id ou sem razão social', async () => {
    queryResult = {
      data: [
        { depositor_id: null, depositors: { razao_social: 'Sem ID' } },
        { depositor_id: 'd-1', depositors: null },
        { depositor_id: 'd-2', depositors: { razao_social: 'Válida' } },
      ],
      error: null,
    }
    expect(await getMyReturnDepositorsAction()).toEqual([{ id: 'd-2', name: 'Válida' }])
  })

  it('filtra pelo operador e descarta devoluções sem depositante', async () => {
    await getMyReturnDepositorsAction()
    expect(argsOf('eq')).toEqual(['received_by', 'op-1'])
    expect(argsOf('not')).toEqual(['depositor_id', 'is', null])
  })

  it('devolve lista vazia quando a query falha', async () => {
    queryResult = { data: null, error: { message: 'timeout' } }
    expect(await getMyReturnDepositorsAction()).toEqual([])
  })

  it('devolve lista vazia quando a query não retorna dados', async () => {
    queryResult = { data: null, error: null }
    expect(await getMyReturnDepositorsAction()).toEqual([])
  })

  it('devolve lista vazia sem propagar exceção', async () => {
    getCurrentUserMock.mockRejectedValue(new Error('sessão expirada'))
    expect(await getMyReturnDepositorsAction()).toEqual([])
  })
})
