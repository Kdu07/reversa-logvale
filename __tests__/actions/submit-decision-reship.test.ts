import { describe, it, expect, vi, beforeEach } from 'vitest'
import { submitDecisionAction } from '@/app/(client)/cliente/actions'

// vi.mock é içado para o topo do arquivo — a const precisa ser içada junto
const { RESHIP_CNPJ } = vi.hoisted(() => ({ RESHIP_CNPJ: '11222333000181' }))

// Reenvio liberado só para RESHIP_CNPJ (nos demais testes a lista fica vazia)
vi.mock('@/lib/env', async (importActual) => {
  const actual = await importActual<typeof import('@/lib/env')>()
  return { env: { ...actual.env, reshipDepositorCnpjs: [RESHIP_CNPJ] } }
})

const mockUpdateEq2 = vi.fn()
const mockUpdateEq1 = vi.fn().mockReturnValue({ eq: mockUpdateEq2 })
const mockUpdate    = vi.fn().mockReturnValue({ eq: mockUpdateEq1 })
const mockSingle    = vi.fn()
const mockSelectEq  = vi.fn().mockReturnValue({ single: mockSingle })
const mockSelect    = vi.fn().mockReturnValue({ eq: mockSelectEq })
const mockFrom      = vi.fn().mockReturnValue({ update: mockUpdate, select: mockSelect })

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({ from: mockFrom })),
}))

vi.mock('@/lib/supabase/get-current-user', () => ({
  getCurrentUser: vi.fn(),
}))

import { getCurrentUser } from '@/lib/supabase/get-current-user'

function mockClient() {
  vi.mocked(getCurrentUser).mockResolvedValue({
    id:      'user-1',
    email:   'test@test.com',
    profile: { id: 'user-1', role: 'client', active: true, full_name: 'Test', phone: null, terms_accepted_at: null, created_at: '' },
  } as never)
}

function mockDepositor(cnpj: string | null) {
  mockSingle.mockResolvedValue({ data: { depositors: cnpj ? { cnpj } : null }, error: null })
}

beforeEach(() => {
  vi.clearAllMocks()
  mockUpdateEq2.mockResolvedValue({ error: null })
})

describe('submitDecisionAction — Reenvio', () => {
  const LABEL = 'ret-1/1700000000000-etiqueta.pdf'
  const DANFE = 'ret-1/1700000000000-danfe.pdf'

  it('aceita reenvio com etiqueta e DANFE para depositante liberado', async () => {
    mockClient()
    mockDepositor(RESHIP_CNPJ)

    const result = await submitDecisionAction({
      returnId:             'ret-1',
      decision:             'reship',
      returnInvoiceXmlPath: null,
      reshipLabelPath:      LABEL,
      reshipDanfePath:      DANFE,
    })

    expect(result).toEqual({ ok: true })
    const update = mockUpdate.mock.calls[0][0]
    expect(update).toMatchObject({
      status: 'decided', decision: 'reship', reship_label_url: LABEL, reship_danfe_url: DANFE,
    })
    // Reenvio segue com a mesma NF: não mexe na coluna da NF de devolução
    expect(update).not.toHaveProperty('return_invoice_xml_url')
  })

  it('exige a etiqueta mesmo para depositante liberado', async () => {
    mockClient()
    mockDepositor(RESHIP_CNPJ)

    const result = await submitDecisionAction({
      returnId:             'ret-1',
      decision:             'reship',
      returnInvoiceXmlPath: 'decisions/ret-1/nf.xml',
    })

    expect((result as { error: string }).error).toContain('etiqueta')
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('recusa etiqueta fora da pasta da devolução ou que não seja PDF', async () => {
    mockClient()
    mockDepositor(RESHIP_CNPJ)

    for (const reshipLabelPath of ['outra-devolucao/1.pdf', 'ret-1/1.png']) {
      const result = await submitDecisionAction({
        returnId: 'ret-1', decision: 'reship', returnInvoiceXmlPath: null, reshipLabelPath, reshipDanfePath: DANFE,
      })
      expect((result as { error: string }).error).toContain('etiqueta')
    }
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('exige a DANFE junto com a etiqueta', async () => {
    mockClient()
    mockDepositor(RESHIP_CNPJ)

    for (const reshipDanfePath of [null, 'outra-devolucao/1-danfe.pdf', 'ret-1/1-danfe.xml']) {
      const result = await submitDecisionAction({
        returnId: 'ret-1', decision: 'reship', returnInvoiceXmlPath: null, reshipLabelPath: LABEL, reshipDanfePath,
      })
      expect((result as { error: string }).error).toContain('DANFE')
    }
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('recusa reenvio de depositante fora da lista', async () => {
    mockClient()
    mockDepositor('99888777000166')

    const result = await submitDecisionAction({
      returnId:             'ret-1',
      decision:             'reship',
      returnInvoiceXmlPath: null,
      reshipLabelPath:      LABEL,
      reshipDanfePath:      DANFE,
    })

    expect((result as { error: string }).error).toContain('Reenvio')
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('recusa reenvio de devolução sem depositante', async () => {
    mockClient()
    mockDepositor(null)

    const result = await submitDecisionAction({
      returnId:             'ret-1',
      decision:             'reship',
      returnInvoiceXmlPath: null,
      reshipLabelPath:      LABEL,
      reshipDanfePath:      DANFE,
    })

    expect(result).toHaveProperty('error')
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('outras decisões ignoram a etiqueta e seguem gravando o XML', async () => {
    mockClient()

    const result = await submitDecisionAction({
      returnId:             'ret-1',
      decision:             'discard',
      returnInvoiceXmlPath: 'decisions/ret-1/nf.xml',
      reshipLabelPath:      LABEL,
      reshipDanfePath:      DANFE,
    })

    expect(result).toEqual({ ok: true })
    const update = mockUpdate.mock.calls[0][0]
    expect(update).toMatchObject({ return_invoice_xml_url: 'decisions/ret-1/nf.xml' })
    expect(update).not.toHaveProperty('reship_label_url')
    expect(update).not.toHaveProperty('reship_danfe_url')
  })
})
