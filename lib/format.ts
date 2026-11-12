import type { DecisionSource, IdentifierType } from '@/types'

/** Rótulos do tipo de identificação, usados em exports e relatórios. */
export const IDENTIFIER_TYPE_LABELS: Record<IdentifierType, string> = {
  access_key:     'Chave NF',
  postal_code:    'CEP',
  logistics_code: 'Código de Logística Reversa',
  illegible:      'Ilegível',
}

/** Quem tomou a decisão: o cliente ou o job de auto-decisão de 72h. */
export const DECIDED_BY_LABELS: Record<DecisionSource, string> = {
  client: 'Cliente',
  auto:   'Automático',
}

/**
 * Data/hora sempre em Brasília. Sem `timeZone` fixo o resultado seguiria o fuso
 * do runtime — o que renderiza em UTC (3h adiantado) em tudo que roda no
 * servidor: relatórios, exports, Server Components e e-mails.
 */
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
    timeZone: 'America/Sao_Paulo',
  })
}

export function identifierLabel(row: {
  identifierType: IdentifierType
  accessKey:      string | null
  postalCode:     string | null
  logisticsCode:  string | null
  illegibleToken: string | null
}): string {
  if (row.identifierType === 'access_key') return `Chave: ${row.accessKey}`
  const base =
    row.identifierType === 'postal_code'    ? `CEP: ${row.postalCode}` :
    row.identifierType === 'logistics_code' ? `Cód. Logística Reversa: ${row.logisticsCode}` :
    `Ilegível: ${row.illegibleToken}`
  // Recebida sem chave, mas o cliente a informou depois (/cliente/notas-pendentes)
  return row.accessKey ? `${base} · Chave: ${row.accessKey}` : base
}

/**
 * Estado dos produtos registrado no recebimento (Etapa 3). Deriva de
 * `damaged_item_count`: `null` = não avaliado (recebida antes da etapa
 * existir) → `null`; `0` → "Bom"; `n > 0` → "Avaria (n de N)".
 */
export function itemConditionLabel(itemCount: number, damagedItemCount: number | null): string | null {
  if (damagedItemCount === null) return null
  if (damagedItemCount === 0) return 'Bom'
  return `Avaria (${damagedItemCount} de ${itemCount})`
}

/**
 * Coluna "NF Origem" dos relatórios: só a chave de acesso, sem rótulo. Sem
 * chave (recebida por CEP/código/ilegível e ainda não informada), cai no
 * identificador usado no recebimento, com o rótulo — ex.: "CEP: 01310-100".
 */
export function originNfLabel(row: Parameters<typeof identifierLabel>[0]): string {
  return row.accessKey ?? identifierLabel(row)
}

/**
 * Coluna "NF Devolução" dos relatórios: a chave lida do XML da NF de devolução.
 * Sem XML (Tratativa, Reenvio, ainda não decidida) → "—".
 */
export function returnNfLabel(row: { returnInvoiceKey: string | null; hasReturnInvoice: boolean }): string {
  if (row.returnInvoiceKey) return row.returnInvoiceKey
  return row.hasReturnInvoice ? 'XML anexado (chave não identificada)' : '—'
}

/**
 * Nome de arquivo amigável para o download de um XML de devolução, usado como
 * `filename` na signed URL (Content-Disposition). Ex.: "RV2024001-nf-devolucao.xml".
 * `kind` distingue a NF original da NF de devolução enviada pelo cliente.
 */
export function xmlDownloadName(rv: string, kind: 'original' | 'devolucao'): string {
  const safe = (rv || 'nf').replace(/[^\w.-]+/g, '_')
  return `${safe}-nf-${kind}.xml`
}

/**
 * Nome de arquivo amigável para a etiqueta da decisão "Reenvio".
 * Ex.: "RV2024001-etiqueta-reenvio.pdf".
 */
export function reshipLabelDownloadName(rv: string): string {
  const safe = (rv || 'rv').replace(/[^\w.-]+/g, '_')
  return `${safe}-etiqueta-reenvio.pdf`
}

/** DANFE anexada na decisão "Reenvio". Ex.: "RV2024001-danfe-reenvio.pdf". */
export function reshipDanfeDownloadName(rv: string): string {
  const safe = (rv || 'rv').replace(/[^\w.-]+/g, '_')
  return `${safe}-danfe-reenvio.pdf`
}
