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
