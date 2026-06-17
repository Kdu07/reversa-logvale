import type { IdentifierType } from '@/types'

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export function identifierLabel(row: {
  identifierType: IdentifierType
  accessKey:      string | null
  postalCode:     string | null
  illegibleToken: string | null
}): string {
  if (row.identifierType === 'access_key')  return `Chave: ${row.accessKey}`
  if (row.identifierType === 'postal_code') return `CEP: ${row.postalCode}`
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
