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
  if (row.identifierType === 'access_key')      return `Chave: ${row.accessKey}`
  if (row.identifierType === 'postal_code')     return `CEP: ${row.postalCode}`
  if (row.identifierType === 'logistics_code')  return `Cód. Logística Reversa: ${row.logisticsCode}`
  return `Ilegível: ${row.illegibleToken}`
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
 * Nome de arquivo amigável para o download do DANFE (PDF) da NF original.
 * Ex.: "RV2024001-danfe.pdf".
 */
export function danfeDownloadName(rv: string): string {
  const safe = (rv || 'nf').replace(/[^\w.-]+/g, '_')
  return `${safe}-danfe.pdf`
}
