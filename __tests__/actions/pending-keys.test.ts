import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  getPendingKeysAction,
  informAccessKeyAction,
} from '@/app/(client)/cliente/notas-pendentes/actions'
import { buildSignedUrlMap } from '@/lib/supabase/storage'

const currentUser = {
  id: 'c-1', email: 'cliente@acme.com', profile: { role: 'client' },
}
const getCurrentUserMock = vi.fn(() => Promise.resolve(currentUser))
vi.mock('@/lib/supabase/get-current-user', () => ({
  getCurrentUser: () => getCurrentUserMock(),
}))

const isSuperUser = vi.fn().mockReturnValue(false)
vi.mock('@/lib/auth/super', () => ({ isSuperUser: (u: unknown) => isSuperUser(u) }))

vi.mock('@/lib/supabase/storage', () => ({ buildSignedUrlMap: vi.fn() }))

// --- server client (fila + contagem) ---
// Listagem: select().is('access_key').eq|neq('status').order().limit()
const awaitingResult = { data: [] as unknown[], error: null as unknown }
const decidedResult  = { data: [] as unknown[], error: null as unknown }
const statusFilters: string[] = []
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({
    from: () => ({
      select: () => ({
        is: () => ({
          eq: (_col: string, _v: string) => {
            statusFilters.push('eq')
            return { order: () => ({ limit: () => Promise.resolve(awaitingResult) }) }
          },
          neq: (_col: string, _v: string) => {
            statusFilters.push('neq')
            return { order: () => ({ limit: () => Promise.resolve(decidedResult) }) }
          },
        }),
      }),
    }),
  })),
}))

// --- admin client (gravação da chave) ---
let returnResult: { data: unknown; error: unknown } = { data: null, error: null }
let linkResult:   { data: unknown }                 = { data: null }
let updateResult: { data: unknown; error: unknown } = { data: [{ id: 'r' }], error: null }
const updateMock = vi.fn(() => ({
  eq: () => ({ is: () => ({ select: () => Promise.resolve(updateResult) }) }),
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => ({
    from: (table: string) =>
      table === 'returns'
        ? {
            select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve(returnResult) }) }),
            update: updateMock,
          }
        : {
            select: () => ({
              eq: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve(linkResult) }) }),
            }),
          },
  })),
}))

const RETURN_ID = '11111111-1111-1111-1111-111111111111'
// CNPJ do emitente 12345678000195, DV válido
const VALID_KEY = '35260712345678000195550010000123451234567898'
// CNPJ do emitente 33009911002506 (exemplo do manual da SEFAZ), DV válido
const OTHER_CNPJ_KEY = '52060433009911002506550120000007800267301615'

const rawReturn = (overrides: Record<string, unknown> = {}) => ({
  id: RETURN_ID, rv: 'RV2024031', identifier_type: 'logistics_code',
  postal_code: null, logistics_code: 'LR-88213', illegible_token: null,
  item_count: 3, received_at: '2026-07-28T10:00:00Z', final_customer_name: null,
  status: 'awaiting_decision', decision: null, decided_at: null, decided_by_type: null,
  depositors: { razao_social: 'ACME LTDA' },
  return_photos: [],
  ...overrides,
})

beforeEach(() => {
  vi.clearAllMocks()
  isSuperUser.mockReturnValue(false)
  currentUser.profile.role = 'client'
  getCurrentUserMock.mockImplementation(() => Promise.resolve(currentUser))
  vi.mocked(buildSignedUrlMap).mockResolvedValue(new Map())
  awaitingResult.data  = []
  awaitingResult.error = null
  decidedResult.data   = []
  decidedResult.error  = null
  statusFilters.length = 0
  returnResult = {
    data: { id: RETURN_ID, depositor_id: 'd-1', access_key: null, depositors: { cnpj: '12345678000195' } },
    error: null,
  }
  linkResult   = { data: { client_id: 'c-1' } }
  updateResult = { data: [{ id: RETURN_ID }], error: null }
})

describe('getPendingKeysAction', () => {
  it('nega acesso a quem não é cliente nem super', async () => {
    currentUser.profile.role = 'operator'
    expect(await getPendingKeysAction()).toEqual({ error: 'Acesso negado' })
  })

  it('separa aguardando decisão e decididas', async () => {
    awaitingResult.data = [rawReturn()]
    decidedResult.data  = [rawReturn({
      id: 'r-2', rv: 'RV2024032', status: 'decided', decision: 'store_for_handling',
      decided_at: '2026-07-31T10:00:00Z', decided_by_type: 'auto',
    })]

    const result = await getPendingKeysAction()

    if ('error' in result) throw new Error(result.error)
    expect(statusFilters.sort()).toEqual(['eq', 'neq'])
    expect(result.awaiting).toHaveLength(1)
    expect(result.awaiting[0]).toMatchObject({
      rv: 'RV2024031', logisticsCode: 'LR-88213', depositorName: 'ACME LTDA', itemCount: 3,
      status: 'awaiting_decision',
    })
    expect(result.decided).toHaveLength(1)
    expect(result.decided[0]).toMatchObject({ rv: 'RV2024032', decision: 'store_for_handling', decidedByType: 'auto' })
    expect(result.awaitingTruncated).toBe(false)
    expect(result.decidedTruncated).toBe(false)
  })

  it('ordena as fotos de cada tipo por position', async () => {
    awaitingResult.data = [rawReturn({
      depositors: null,
      return_photos: [
        { storage_path: 'b2', photo_type: 'box',  position: 2 },
        { storage_path: 'b1', photo_type: 'box',  position: 1 },
        { storage_path: 'i1', photo_type: 'item', position: 1 },
      ],
    })]
    vi.mocked(buildSignedUrlMap).mockResolvedValue(
      new Map([['b1', 'url-b1'], ['b2', 'url-b2'], ['i1', 'url-i1']]),
    )

    const result = await getPendingKeysAction()

    if ('error' in result) throw new Error(result.error)
    expect(result.awaiting[0].boxPhotoUrls).toEqual(['url-b1', 'url-b2'])
    expect(result.awaiting[0].itemPhotoUrls).toEqual(['url-i1'])
    expect(result.awaiting[0].depositorName).toBeNull()
  })

  it('sinaliza truncamento por grupo ao atingir o teto', async () => {
    decidedResult.data = Array.from({ length: 100 }, (_, i) => rawReturn({ id: `r-${i}`, status: 'decided' }))
    const result = await getPendingKeysAction()
    if ('error' in result) throw new Error(result.error)
    expect(result.decidedTruncated).toBe(true)
    expect(result.awaitingTruncated).toBe(false)
  })

  it('propaga erro de qualquer uma das consultas', async () => {
    decidedResult.error = { message: 'falha na consulta' }
    expect(await getPendingKeysAction()).toEqual({ error: 'falha na consulta' })
    decidedResult.error  = null
    awaitingResult.error = { message: 'outra falha' }
    expect(await getPendingKeysAction()).toEqual({ error: 'outra falha' })
  })

  it('devolve mensagem de erro quando a sessão falha', async () => {
    getCurrentUserMock.mockRejectedValue(new Error('sessão expirada'))
    expect(await getPendingKeysAction()).toEqual({ error: 'sessão expirada' })
  })
})

describe('informAccessKeyAction', () => {
  it('nega acesso a quem não é cliente nem super', async () => {
    currentUser.profile.role = 'operator'
    expect(await informAccessKeyAction(RETURN_ID, VALID_KEY)).toEqual({ error: 'Acesso negado' })
    expect(updateMock).not.toHaveBeenCalled()
  })

  it('exige a devolução', async () => {
    expect(await informAccessKeyAction('', VALID_KEY)).toEqual({ error: 'Devolução não informada.' })
  })

  it('exige 44 dígitos', async () => {
    const result = await informAccessKeyAction(RETURN_ID, '3526 0712')
    expect(result).toMatchObject({ error: expect.stringContaining('44 dígitos (você informou 8)') })
    expect(updateMock).not.toHaveBeenCalled()
  })

  it('recusa dígito verificador inválido', async () => {
    const result = await informAccessKeyAction(RETURN_ID, `${VALID_KEY.slice(0, 43)}0`)
    expect(result).toMatchObject({ error: expect.stringContaining('dígito verificador') })
    expect(updateMock).not.toHaveBeenCalled()
  })

  it('recusa devolução inexistente', async () => {
    returnResult = { data: null, error: null }
    expect(await informAccessKeyAction(RETURN_ID, VALID_KEY)).toEqual({ error: 'Devolução não encontrada.' })
  })

  it('propaga erro ao buscar a devolução', async () => {
    returnResult = { data: null, error: { message: 'conexão perdida' } }
    expect(await informAccessKeyAction(RETURN_ID, VALID_KEY)).toEqual({ error: 'conexão perdida' })
  })

  it('nega quando o cliente não tem vínculo com o depositante', async () => {
    linkResult = { data: null }
    expect(await informAccessKeyAction(RETURN_ID, VALID_KEY)).toEqual({ error: 'Acesso negado' })
    expect(updateMock).not.toHaveBeenCalled()
  })

  it('nega quando a devolução está sem depositante', async () => {
    returnResult = { data: { id: RETURN_ID, depositor_id: null, access_key: null, depositors: null }, error: null }
    expect(await informAccessKeyAction(RETURN_ID, VALID_KEY)).toEqual({ error: 'Acesso negado' })
  })

  it('não sobrescreve uma chave já existente', async () => {
    returnResult = {
      data: { id: RETURN_ID, depositor_id: 'd-1', access_key: VALID_KEY, depositors: { cnpj: '12345678000195' } },
      error: null,
    }
    const result = await informAccessKeyAction(RETURN_ID, VALID_KEY)
    expect(result).toEqual({ error: 'Esta devolução já tem a chave de acesso.' })
    expect(updateMock).not.toHaveBeenCalled()
  })

  it('recusa chave emitida por outro CNPJ que não o do depositante', async () => {
    const result = await informAccessKeyAction(RETURN_ID, OTHER_CNPJ_KEY)
    expect(result).toMatchObject({ error: expect.stringContaining('outro CNPJ') })
    expect(updateMock).not.toHaveBeenCalled()
  })

  it('grava a chave (normalizada) com a procedência', async () => {
    const pasted = VALID_KEY.replace(/(\d{4})/g, '$1 ').trim()
    const result = await informAccessKeyAction(RETURN_ID, pasted)

    expect(result).toEqual({ ok: true, accessKey: VALID_KEY })
    expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({
      access_key:             VALID_KEY,
      access_key_informed_by: 'c-1',
      access_key_informed_at: expect.any(String),
    }))
  })

  it('trata a corrida em que outra pessoa informou a chave antes', async () => {
    updateResult = { data: [], error: null }
    expect(await informAccessKeyAction(RETURN_ID, VALID_KEY)).toEqual({ error: 'Esta devolução já tem a chave de acesso.' })
  })

  it('propaga erro do update', async () => {
    updateResult = { data: null, error: { message: 'update rejeitado' } }
    expect(await informAccessKeyAction(RETURN_ID, VALID_KEY)).toEqual({ error: 'update rejeitado' })
  })

  it('permite o super informar sem vínculo de depositante', async () => {
    isSuperUser.mockReturnValue(true)
    currentUser.profile.role = 'manager'
    linkResult = { data: null }
    expect(await informAccessKeyAction(RETURN_ID, VALID_KEY)).toEqual({ ok: true, accessKey: VALID_KEY })
  })

  it('devolve mensagem de erro quando a sessão falha', async () => {
    getCurrentUserMock.mockRejectedValue(new Error('sessão expirada'))
    expect(await informAccessKeyAction(RETURN_ID, VALID_KEY)).toEqual({ error: 'sessão expirada' })
  })
})
