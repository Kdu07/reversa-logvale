import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  getPendingInvoicesAction,
  countPendingInvoicesAction,
  uploadInvoiceFileAction,
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

vi.mock('@/lib/integrations/nfeio', () => ({
  parseFinalCustomerName: (xml: string) => (xml.includes('<dest>') ? 'CLIENTE FINAL LTDA' : null),
}))

// --- server client (leitura da fila + contagem) ---
// A cadeia `.neq().is().is()` é compartilhada: a listagem segue com `.order()`,
// a contagem consome o resultado direto.
const listResult  = { data: [] as unknown[], error: null as unknown }
const countResult = { count: 0 as number | null }
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({
    from: () => ({
      select: () => ({
        neq: () => ({
          is: () => ({
            is: () => Object.assign(
              Promise.resolve(countResult),
              { order: () => ({ limit: () => Promise.resolve(listResult) }) },
            ),
          }),
        }),
      }),
    }),
  })),
}))

// --- admin client (upload) ---
let returnResult: { data: unknown; error: unknown } = { data: null, error: null }
let linkResult:   { data: unknown }                 = { data: null }
const uploadMock  = vi.fn().mockResolvedValue({ error: null })
const removeMock  = vi.fn().mockResolvedValue({ error: null })
const updateEq    = vi.fn().mockResolvedValue({ error: null })
const updateMock  = vi.fn(() => ({ eq: updateEq }))
const bucketsUsed: string[] = []

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
    storage: {
      from: (bucket: string) => {
        bucketsUsed.push(bucket)
        return { upload: uploadMock, remove: removeMock }
      },
    },
  })),
}))

const RETURN_ID = '11111111-1111-1111-1111-111111111111'

function makeForm(file: File | null, returnId: string | null = RETURN_ID): FormData {
  const form = new FormData()
  if (returnId !== null) form.set('returnId', returnId)
  if (file)              form.set('file', file)
  return form
}

const xmlFile = (content = '<nfeProc><dest><xNome>ACME</xNome></dest></nfeProc>') =>
  new File([content], 'nota.xml', { type: 'text/xml' })

const pdfFile = () => new File(['%PDF-1.4'], 'danfe.pdf', { type: 'application/pdf' })

beforeEach(() => {
  vi.clearAllMocks()
  isSuperUser.mockReturnValue(false)
  currentUser.profile.role = 'client'
  getCurrentUserMock.mockImplementation(() => Promise.resolve(currentUser))
  vi.mocked(buildSignedUrlMap).mockResolvedValue(new Map())
  listResult.data  = []
  listResult.error = null
  countResult.count = 0
  returnResult = {
    data: {
      id: RETURN_ID, depositor_id: 'd-1',
      invoice_xml_url: null, invoice_pdf_url: null, final_customer_name: null,
    },
    error: null,
  }
  linkResult = { data: { client_id: 'c-1' } }
  uploadMock.mockResolvedValue({ error: null })
  removeMock.mockResolvedValue({ error: null })
  updateEq.mockResolvedValue({ error: null })
  bucketsUsed.length = 0
})

describe('getPendingInvoicesAction', () => {
  it('nega acesso a quem não é cliente nem super', async () => {
    currentUser.profile.role = 'operator'
    expect(await getPendingInvoicesAction()).toEqual({ error: 'Acesso negado' })
  })

  it('mapeia as devoluções sem NF, com fotos separadas por tipo', async () => {
    listResult.data = [{
      id: RETURN_ID, rv: 'RV2024031', identifier_type: 'logistics_code',
      postal_code: null, logistics_code: 'LR-88213', illegible_token: null,
      item_count: 3, received_at: '2026-07-28T10:00:00Z', final_customer_name: null,
      status: 'awaiting_decision', decision: null, decided_at: null, decided_by_type: null,
      depositors: { razao_social: 'ACME LTDA' },
      return_photos: [
        { storage_path: 'b1', photo_type: 'box',  position: 1 },
        { storage_path: 'i1', photo_type: 'item', position: 1 },
      ],
    }]

    const result = await getPendingInvoicesAction()

    expect('rows' in result).toBe(true)
    if (!('rows' in result)) return
    expect(result.rows).toHaveLength(1)
    expect(result.truncated).toBe(false)
    expect(result.rows[0]).toMatchObject({
      rv: 'RV2024031', logisticsCode: 'LR-88213', depositorName: 'ACME LTDA', itemCount: 3,
    })
  })

  it('ordena as fotos de cada tipo por position', async () => {
    listResult.data = [{
      id: RETURN_ID, rv: 'RV2024031', identifier_type: 'postal_code',
      postal_code: '01310-100', logistics_code: null, illegible_token: null,
      item_count: 1, received_at: '2026-07-28T10:00:00Z', final_customer_name: null,
      status: 'awaiting_decision', decision: null, decided_at: null, decided_by_type: null,
      depositors: null,
      return_photos: [
        { storage_path: 'b2', photo_type: 'box',  position: 2 },
        { storage_path: 'b1', photo_type: 'box',  position: 1 },
        { storage_path: 'i1', photo_type: 'item', position: 1 },
      ],
    }]
    vi.mocked(buildSignedUrlMap).mockResolvedValue(
      new Map([['b1', 'url-b1'], ['b2', 'url-b2'], ['i1', 'url-i1']]),
    )

    const result = await getPendingInvoicesAction()

    if (!('rows' in result)) throw new Error('esperava rows')
    expect(result.rows[0].boxPhotoUrls).toEqual(['url-b1', 'url-b2'])
    expect(result.rows[0].depositorName).toBeNull()
  })

  it('propaga erro da query', async () => {
    listResult.error = { message: 'falha na consulta' }
    expect(await getPendingInvoicesAction()).toEqual({ error: 'falha na consulta' })
  })

  it('devolve mensagem de erro quando a sessão falha', async () => {
    getCurrentUserMock.mockRejectedValue(new Error('sessão expirada'))
    expect(await getPendingInvoicesAction()).toEqual({ error: 'sessão expirada' })
  })
})

describe('countPendingInvoicesAction', () => {
  it('retorna a contagem da fila', async () => {
    countResult.count = 4
    expect(await countPendingInvoicesAction()).toBe(4)
  })

  it('retorna 0 para quem não é cliente nem super', async () => {
    currentUser.profile.role = 'manager'
    expect(await countPendingInvoicesAction()).toBe(0)
  })

  it('retorna 0 quando a contagem vem nula', async () => {
    countResult.count = null
    expect(await countPendingInvoicesAction()).toBe(0)
  })

  it('retorna 0 sem propagar exceção — o badge não pode quebrar o layout', async () => {
    getCurrentUserMock.mockRejectedValue(new Error('sessão expirada'))
    expect(await countPendingInvoicesAction()).toBe(0)
  })
})

describe('uploadInvoiceFileAction', () => {
  it('nega acesso a quem não é cliente nem super', async () => {
    currentUser.profile.role = 'operator'
    expect(await uploadInvoiceFileAction(makeForm(xmlFile()))).toEqual({ error: 'Acesso negado' })
    expect(uploadMock).not.toHaveBeenCalled()
  })

  it('exige a devolução', async () => {
    const result = await uploadInvoiceFileAction(makeForm(xmlFile(), null))
    expect(result).toEqual({ error: 'Devolução não informada.' })
  })

  it('exige um arquivo', async () => {
    const result = await uploadInvoiceFileAction(makeForm(null))
    expect(result).toEqual({ error: 'Selecione um arquivo.' })
  })

  it('recusa formatos fora de XML/PDF', async () => {
    const txt = new File(['nota'], 'nota.txt', { type: 'text/plain' })
    const result = await uploadInvoiceFileAction(makeForm(txt))
    expect(result).toMatchObject({ error: expect.stringContaining('Formato não aceito') })
    expect(uploadMock).not.toHaveBeenCalled()
  })

  it('recusa arquivo acima de 5 MB', async () => {
    const big = pdfFile()
    Object.defineProperty(big, 'size', { value: 6 * 1024 * 1024 })
    const result = await uploadInvoiceFileAction(makeForm(big))
    expect(result).toMatchObject({ error: expect.stringContaining('muito grande') })
    expect(uploadMock).not.toHaveBeenCalled()
  })

  it('recusa devolução inexistente', async () => {
    returnResult = { data: null, error: null }
    const result = await uploadInvoiceFileAction(makeForm(xmlFile()))
    expect(result).toEqual({ error: 'Devolução não encontrada.' })
  })

  it('nega quando o cliente não tem vínculo com o depositante', async () => {
    linkResult = { data: null }
    const result = await uploadInvoiceFileAction(makeForm(xmlFile()))
    expect(result).toEqual({ error: 'Acesso negado' })
    expect(uploadMock).not.toHaveBeenCalled()
  })

  it('nega quando a devolução está sem depositante', async () => {
    returnResult = {
      data: { id: RETURN_ID, depositor_id: null, invoice_xml_url: null, invoice_pdf_url: null, final_customer_name: null },
      error: null,
    }
    const result = await uploadInvoiceFileAction(makeForm(xmlFile()))
    expect(result).toEqual({ error: 'Acesso negado' })
  })

  it('não sobrescreve XML já existente', async () => {
    returnResult = {
      data: { id: RETURN_ID, depositor_id: 'd-1', invoice_xml_url: 'ak/x.xml', invoice_pdf_url: null, final_customer_name: null },
      error: null,
    }
    const result = await uploadInvoiceFileAction(makeForm(xmlFile()))
    expect(result).toMatchObject({ error: expect.stringContaining('já tem o XML') })
    expect(uploadMock).not.toHaveBeenCalled()
  })

  it('não sobrescreve DANFE já existente', async () => {
    returnResult = {
      data: { id: RETURN_ID, depositor_id: 'd-1', invoice_xml_url: null, invoice_pdf_url: 'ak/x.pdf', final_customer_name: null },
      error: null,
    }
    const result = await uploadInvoiceFileAction(makeForm(pdfFile()))
    expect(result).toMatchObject({ error: expect.stringContaining('já tem o DANFE') })
    expect(uploadMock).not.toHaveBeenCalled()
  })

  it('grava o XML no bucket de XMLs e extrai o cliente final', async () => {
    const result = await uploadInvoiceFileAction(makeForm(xmlFile()))

    expect(result).toMatchObject({ ok: true, kind: 'xml', finalCustomerName: 'CLIENTE FINAL LTDA' })
    expect(bucketsUsed).toContain('invoice-xmls')
    expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({
      invoice_xml_url:     expect.stringContaining(`manual/${RETURN_ID}/`),
      invoice_uploaded_by: 'c-1',
      final_customer_name: 'CLIENTE FINAL LTDA',
    }))
  })

  it('não sobrescreve o cliente final já preenchido', async () => {
    returnResult = {
      data: { id: RETURN_ID, depositor_id: 'd-1', invoice_xml_url: null, invoice_pdf_url: null, final_customer_name: 'JÁ EXISTE' },
      error: null,
    }
    const result = await uploadInvoiceFileAction(makeForm(xmlFile()))

    expect(result).toMatchObject({ ok: true, finalCustomerName: null })
    expect(updateMock).toHaveBeenCalledWith(expect.not.objectContaining({ final_customer_name: expect.anything() }))
  })

  it('grava o PDF no bucket de DANFEs', async () => {
    const result = await uploadInvoiceFileAction(makeForm(pdfFile()))

    expect(result).toMatchObject({ ok: true, kind: 'pdf' })
    expect(bucketsUsed).toContain('invoice-pdfs')
    expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({
      invoice_pdf_url: expect.stringContaining(`manual/${RETURN_ID}/`),
    }))
  })

  it('propaga erro de upload sem tocar na devolução', async () => {
    uploadMock.mockResolvedValue({ error: { message: 'bucket cheio' } })
    const result = await uploadInvoiceFileAction(makeForm(xmlFile()))
    expect(result).toMatchObject({ error: expect.stringContaining('bucket cheio') })
    expect(updateMock).not.toHaveBeenCalled()
  })

  it('remove o arquivo órfão quando o update falha', async () => {
    updateEq.mockResolvedValue({ error: { message: 'update rejeitado' } })
    const result = await uploadInvoiceFileAction(makeForm(xmlFile()))
    expect(result).toEqual({ error: 'update rejeitado' })
    expect(removeMock).toHaveBeenCalledWith([expect.stringContaining(`manual/${RETURN_ID}/`)])
  })

  it('permite o super anexar sem vínculo de depositante', async () => {
    isSuperUser.mockReturnValue(true)
    currentUser.profile.role = 'manager'
    linkResult = { data: null }

    const result = await uploadInvoiceFileAction(makeForm(pdfFile()))
    expect(result).toMatchObject({ ok: true, kind: 'pdf' })
  })

  it('propaga erro ao buscar a devolução', async () => {
    returnResult = { data: null, error: { message: 'conexão perdida' } }
    expect(await uploadInvoiceFileAction(makeForm(xmlFile()))).toEqual({ error: 'conexão perdida' })
  })

  it('devolve mensagem de erro quando a sessão falha', async () => {
    getCurrentUserMock.mockRejectedValue(new Error('sessão expirada'))
    expect(await uploadInvoiceFileAction(makeForm(xmlFile()))).toEqual({ error: 'sessão expirada' })
  })
})
