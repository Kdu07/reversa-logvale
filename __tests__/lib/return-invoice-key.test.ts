import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readReturnInvoiceKey, resolveReturnInvoiceKeys } from '@/lib/return-invoice-key'

const KEY = '52060433009911002506550120000007800267301615'
const xmlWithKey = `<nfeProc><NFe><infNFe Id="NFe${KEY}"></infNFe></NFe></nfeProc>`

/** path → conteúdo do XML no storage (ausente = erro de download) */
let files: Record<string, string>
const downloadMock = vi.fn(async (path: string) =>
  path in files
    ? { data: new Blob([files[path]]), error: null }
    : { data: null, error: { message: 'not found' } },
)
const updateEq   = vi.fn().mockResolvedValue({ error: null })
const updateMock = vi.fn(() => ({ eq: updateEq }))

const adminClient = {
  storage: { from: () => ({ download: downloadMock }) },
  from:    () => ({ update: updateMock }),
}
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => adminClient }))

beforeEach(() => {
  vi.clearAllMocks()
  files = {}
})

describe('readReturnInvoiceKey', () => {
  it('baixa o XML e devolve a chave', async () => {
    files['decisions/r-1/1.xml'] = xmlWithKey
    expect(await readReturnInvoiceKey(adminClient as never, 'decisions/r-1/1.xml')).toBe(KEY)
  })

  it('devolve null quando o download falha', async () => {
    expect(await readReturnInvoiceKey(adminClient as never, 'nao/existe.xml')).toBeNull()
  })

  it('devolve null sem lançar quando o client nem tem storage', async () => {
    expect(await readReturnInvoiceKey({} as never, 'x.xml')).toBeNull()
  })
})

describe('resolveReturnInvoiceKeys', () => {
  it('usa a chave já gravada sem baixar nada', async () => {
    const keys = await resolveReturnInvoiceKeys([
      { id: 'r-1', returnInvoiceXmlPath: 'decisions/r-1/1.xml', returnInvoiceKey: KEY },
      { id: 'r-2', returnInvoiceXmlPath: null,                  returnInvoiceKey: null },
    ])
    expect(keys.get('r-1')).toBe(KEY)
    expect(keys.get('r-2')).toBeNull()
    expect(downloadMock).not.toHaveBeenCalled()
  })

  it('lê do XML e grava de volta as que ainda não têm a chave', async () => {
    files['decisions/r-1/1.xml'] = xmlWithKey
    const keys = await resolveReturnInvoiceKeys([
      { id: 'r-1', returnInvoiceXmlPath: 'decisions/r-1/1.xml', returnInvoiceKey: null },
      { id: 'r-2', returnInvoiceXmlPath: 'decisions/r-2/1.xml', returnInvoiceKey: null }, // download falha
    ])
    expect(keys.get('r-1')).toBe(KEY)
    expect(keys.get('r-2')).toBeNull()
    expect(updateMock).toHaveBeenCalledTimes(1)
    expect(updateMock).toHaveBeenCalledWith({ return_invoice_key: KEY })
    expect(updateEq).toHaveBeenCalledWith('id', 'r-1')
  })
})
