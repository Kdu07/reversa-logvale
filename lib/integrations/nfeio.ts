import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { env } from '@/lib/env'

export interface InvoiceData {
  accessKey:         string
  emitterCnpj:       string
  invoiceNumber:     string | null
  emittedAt:         string | null
  xmlStoragePath:    string | null
  pdfStoragePath:    string | null
  finalCustomerName: string | null
  depositorId:       string | null
  depositorName:     string | null
  // Status da consulta de NF na NFEio (informativo — a falha nunca bloqueia o
  // recebimento). Permite avisar o operador quando o CNPJ foi identificado pela
  // chave, mas o XML/DANFE não foi retornado. `invoiceFetchReason` é null quando
  // o XML foi obtido com sucesso.
  xmlFetched:         boolean
  pdfFetched:         boolean
  invoiceFetchReason: InvoiceFetchReason | null
}

const XML_BUCKET = 'invoice-xmls'
const PDF_BUCKET  = 'invoice-pdfs'
const FETCH_TIMEOUT_MS = 10_000

function adminClient(): SupabaseClient {
  return createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

/** Caminhos no storage, relativos ao bucket, por NF (idempotentes — dedup por chave). */
export const invoiceXmlStoragePath = (accessKey: string) => `ak/${accessKey}.xml`
export const invoicePdfStoragePath = (accessKey: string) => `ak/${accessKey}.pdf`

/**
 * Extrai os dados da NF diretamente da chave de acesso de 44 dígitos.
 *
 * A própria chave codifica o CNPJ do emitente, o número e o mês/ano de emissão,
 * então o mapeamento do depositante (por CNPJ) não depende de consulta externa.
 * Layout (1-indexado): cUF(2) AAMM(4) CNPJ(14) mod(2) série(3) nNF(9) tpEmis(1) cNF(8) cDV(1)
 */
function parseAccessKey(accessKey: string) {
  const emitterCnpj   = accessKey.slice(6, 20)
  const invoiceNumber = String(parseInt(accessKey.slice(25, 34), 10))
  const yy            = accessKey.slice(2, 4)
  const mm            = accessKey.slice(4, 6)
  const emittedAt     = `20${yy}-${mm}-01`
  return { emitterCnpj, invoiceNumber, emittedAt }
}

/** Decodifica as entidades XML básicas (`&amp;` por último para não re-decodificar). */
function decodeXmlEntities(s: string): string {
  return s
    .replace(/&lt;/g,   '<')
    .replace(/&gt;/g,   '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g,  "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g,  '&')
}

/**
 * Extrai o nome do cliente final (destinatário) do XML da NF-e.
 *
 * No layout nfeProc/NFe, o destinatário é `<dest><xNome>…</xNome></dest>` — quem
 * comprou/recebeu o produto. A busca é restrita ao bloco `<dest>` de propósito,
 * para não capturar o `<xNome>` do `<emit>` (que corresponde ao depositante).
 */
export function parseFinalCustomerName(xml: string): string | null {
  const destBlock = xml.match(/<dest\b[^>]*>([\s\S]*?)<\/dest>/i)?.[1]
  if (!destBlock) return null
  const xNome = destBlock.match(/<xNome\b[^>]*>([\s\S]*?)<\/xNome>/i)?.[1]
  if (!xNome) return null
  return decodeXmlEntities(xNome).trim() || null
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

  // Busca e persiste XML + DANFE na própria bipagem (decisão: Etapa 1).
  // Falha de rede da NFEio NÃO bloqueia o recebimento — os paths ficam `null`
  // e o painel super-only de backfill os recupera depois. Importante: NUNCA
  // gravar string vazia aqui — `''` não é `NULL` e cria devoluções "invisíveis"
  // para o contador/backfill (que filtram por `IS NULL`).
  const { xmlPath, pdfPath, finalCustomerName, xmlReason, pdfReason } =
    await persistInvoiceFiles(accessKey)

  return {
    accessKey,
    emitterCnpj,
    invoiceNumber,
    emittedAt,
    xmlStoragePath:     xmlPath,
    pdfStoragePath:     pdfPath,
    finalCustomerName,
    depositorId:        depositor?.id ?? null,
    depositorName:      depositor?.razao_social ?? null,
    xmlFetched:         xmlPath !== null,
    pdfFetched:         pdfPath !== null,
    // Prioriza o motivo do XML (é o arquivo que o painel rastreia); cai no do PDF.
    invoiceFetchReason: xmlReason ?? pdfReason,
  }
}

// =====================================================================
// Integração NFEio — consulta de NF-e por chave de acesso
// Docs: GET {base}/v2/productinvoices/{accessKey}[.xml|.pdf]
// Auth: header `Authorization: <NFEIO_ACCESS_KEY>` (API Key da empresa)
// =====================================================================

export type InvoiceFetchReason = 'disabled' | 'not_found' | 'unauthorized' | 'error'

export type InvoiceXmlResult =
  | { ok: true; xml: string }
  | { ok: false; reason: InvoiceFetchReason; message: string }

export type InvoicePdfResult =
  | { ok: true; pdf: Uint8Array }
  | { ok: false; reason: InvoiceFetchReason; message: string }

function reasonForStatus(status: number): InvoiceFetchReason {
  if (status === 404) return 'not_found'
  if (status === 401 || status === 403) return 'unauthorized'
  return 'error'
}

async function nfeioFetch(path: string): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    return await fetch(`${env.nfeioBaseUrl}/v2/productinvoices/${path}`, {
      headers: { Authorization: env.nfeioApiKey ?? '' },
      signal:  controller.signal,
    })
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Busca o XML (nfeProc completo) da NF-e na NFEio pela chave de acesso.
 *
 * Consumida pelo lookup (via persistInvoiceFiles) e pelo backfill super-only.
 */
export async function fetchInvoiceXml(accessKey: string): Promise<InvoiceXmlResult> {
  if (!env.nfeioEnabled) {
    return { ok: false, reason: 'disabled', message: 'Integração NFEio desativada (NFEIO_ACCESS_KEY ausente)' }
  }
  try {
    const res = await nfeioFetch(`${accessKey}.xml`)
    if (!res.ok) {
      return { ok: false, reason: reasonForStatus(res.status), message: `NFEio respondeu HTTP ${res.status}` }
    }
    return { ok: true, xml: await res.text() }
  } catch (err) {
    return { ok: false, reason: 'error', message: err instanceof Error ? err.message : 'Falha ao consultar NFEio' }
  }
}

/** Busca o DANFE (PDF) da NF-e na NFEio pela chave de acesso. */
export async function fetchInvoicePdf(accessKey: string): Promise<InvoicePdfResult> {
  if (!env.nfeioEnabled) {
    return { ok: false, reason: 'disabled', message: 'Integração NFEio desativada (NFEIO_ACCESS_KEY ausente)' }
  }
  try {
    const res = await nfeioFetch(`${accessKey}.pdf`)
    if (!res.ok) {
      return { ok: false, reason: reasonForStatus(res.status), message: `NFEio respondeu HTTP ${res.status}` }
    }
    return { ok: true, pdf: new Uint8Array(await res.arrayBuffer()) }
  } catch (err) {
    return { ok: false, reason: 'error', message: err instanceof Error ? err.message : 'Falha ao consultar NFEio' }
  }
}

export interface PersistInvoiceResult {
  xmlPath:           string | null
  pdfPath:           string | null
  finalCustomerName: string | null
  // Motivo da ausência de cada arquivo (null quando o arquivo foi persistido).
  xmlReason:         InvoiceFetchReason | null
  pdfReason:         InvoiceFetchReason | null
}

/**
 * Busca XML + DANFE na NFEio e os persiste no storage (upsert, admin client —
 * operador não tem policy de UPDATE, e NFs repetidas exigem bypass de RLS).
 *
 * Best-effort: cada arquivo é independente; falha de um deixa só aquele path
 * `null` (com o respectivo `*Reason`). Nunca lança — o chamador segue o fluxo
 * mesmo sem os arquivos.
 */
export async function persistInvoiceFiles(accessKey: string): Promise<PersistInvoiceResult> {
  if (!env.nfeioEnabled) {
    return { xmlPath: null, pdfPath: null, finalCustomerName: null, xmlReason: 'disabled', pdfReason: 'disabled' }
  }

  const supabase = adminClient()
  const [xmlRes, pdfRes] = await Promise.all([fetchInvoiceXml(accessKey), fetchInvoicePdf(accessKey)])

  let xmlPath: string | null = null
  let xmlReason: InvoiceFetchReason | null = null
  let finalCustomerName: string | null = null
  if (xmlRes.ok) {
    finalCustomerName = parseFinalCustomerName(xmlRes.xml)
    const path = invoiceXmlStoragePath(accessKey)
    const { error } = await supabase.storage
      .from(XML_BUCKET)
      .upload(path, xmlRes.xml, { upsert: true, contentType: 'application/xml' })
    if (!error) xmlPath = path
    else xmlReason = 'error' // NF baixada, mas o upload no storage falhou
  } else {
    xmlReason = xmlRes.reason
  }

  let pdfPath: string | null = null
  let pdfReason: InvoiceFetchReason | null = null
  if (pdfRes.ok) {
    const path = invoicePdfStoragePath(accessKey)
    const { error } = await supabase.storage
      .from(PDF_BUCKET)
      .upload(path, pdfRes.pdf, { upsert: true, contentType: 'application/pdf' })
    if (!error) pdfPath = path
    else pdfReason = 'error'
  } else {
    pdfReason = pdfRes.reason
  }

  return { xmlPath, pdfPath, finalCustomerName, xmlReason, pdfReason }
}
