import { createClient } from '@supabase/supabase-js'
import { env } from '@/lib/env'

export interface InvoiceData {
  accessKey:      string
  emitterCnpj:    string
  invoiceNumber:  string | null
  emittedAt:      string | null
  xmlStoragePath: string
  depositorId:    string | null
  depositorName:  string | null
}

function adminClient() {
  return createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

/**
 * Extrai os dados da NF diretamente da chave de acesso de 44 dígitos.
 *
 * A própria chave codifica o CNPJ do emitente, o número e o mês/ano de emissão,
 * então não é necessária consulta externa para identificar o depositante.
 * Layout (1-indexado): cUF(2) AAMM(4) CNPJ(14) mod(2) série(3) nNF(9) tpEmis(1) cNF(8) cDV(1)
 *
 * O download do XML/DANFE depende de integração fiscal (ex.: API "Consulta de NF-e"
 * da Webmania ou XML fornecido pelo depositante) e fica como evolução pós-launch —
 * a chave é persistida em cada devolução, permitindo backfill posterior.
 */
function parseAccessKey(accessKey: string) {
  const emitterCnpj   = accessKey.slice(6, 20)
  const invoiceNumber = String(parseInt(accessKey.slice(25, 34), 10))
  const yy            = accessKey.slice(2, 4)
  const mm            = accessKey.slice(4, 6)
  const emittedAt     = `20${yy}-${mm}-01`
  return { emitterCnpj, invoiceNumber, emittedAt }
}

export async function lookupInvoice(accessKey: string): Promise<InvoiceData> {
  if (!/^\d{44}$/.test(accessKey)) {
    throw new Error('Chave de acesso inválida (44 dígitos)')
  }

  const { emitterCnpj, invoiceNumber, emittedAt } = parseAccessKey(accessKey)

  // Identifica o depositante pelo CNPJ do emitente codificado na chave
  const supabase = adminClient()
  const { data: depositor } = await supabase
    .from('depositors')
    .select('id, razao_social')
    .eq('cnpj', emitterCnpj)
    .eq('active', true)
    .single()

  return {
    accessKey,
    emitterCnpj,
    invoiceNumber,
    emittedAt,
    // Sem integração fiscal ativa não há XML armazenado; o botão de download
    // em step-review só renderiza quando este campo é truthy.
    xmlStoragePath: '',
    depositorId:    depositor?.id ?? null,
    depositorName:  depositor?.razao_social ?? null,
  }
}

export type InvoiceXmlResult =
  | { ok: true; xml: string }
  | { ok: false; reason: 'not_implemented' | 'not_found' | 'error'; message: string }

/**
 * Busca o XML/DANFE da NF-e pela chave de acesso.
 *
 * STUB: a integração fiscal externa ainda não está implementada. Quando estiver,
 * substituir o corpo por uma chamada OAuth real (ex.: Webmania "Consulta de NF-e")
 * que retorne `{ ok: true, xml }`. Todo o fluxo de retry/persistência que consome
 * esta função (retryMissingInvoiceXmlAction) já está pronto e não precisa mudar.
 */
export async function fetchInvoiceXml(accessKey: string): Promise<InvoiceXmlResult> {
  void accessKey
  return { ok: false, reason: 'not_implemented', message: 'API de consulta de NF ainda não implementada' }
}
