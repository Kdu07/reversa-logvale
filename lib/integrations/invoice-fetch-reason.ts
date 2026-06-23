import type { InvoiceFetchReason } from './nfeio'

/**
 * Texto amigável para o motivo de a NF (XML/DANFE) não ter sido retornada pela
 * NFEio. Client-safe: importa apenas o *tipo* de `nfeio.ts` (apagado em
 * compile-time), então não arrasta o módulo server-side para o bundle do cliente.
 */
export function invoiceFetchReasonLabel(reason: InvoiceFetchReason | null): string {
  switch (reason) {
    case 'disabled':     return 'integração NFEio desativada'
    case 'not_found':    return 'NF não encontrada na NFEio'
    case 'unauthorized': return 'credencial da NFEio inválida'
    case 'error':        return 'falha ao consultar a NFEio'
    default:             return 'motivo não informado'
  }
}
