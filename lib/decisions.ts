import type { ReturnDecision } from '@/types'
import { ptBR } from '@/lib/i18n/pt-BR'

export const DECISION_LABELS: Record<ReturnDecision, string> = {
  return_to_stock:    ptBR.decisions.return_to_stock,
  store_for_handling: ptBR.decisions.store_for_handling,
  discard:            ptBR.decisions.discard,
  repackage:          ptBR.decisions.repackage,
  reship:             ptBR.decisions.reship,
}

export const DECISION_SHORT: Record<ReturnDecision, string> = {
  return_to_stock:    'Estoque',
  store_for_handling: 'Tratativa',
  discard:            'Retirada',
  repackage:          'Reembal.',
  reship:             'Reenvio',
}

export const DECISION_TONE: Record<ReturnDecision, 'success' | 'warning' | 'destructive' | 'info'> = {
  return_to_stock:    'success',
  store_for_handling: 'warning',
  discard:            'destructive',
  repackage:          'info',
  reship:             'info',
}

export const DECISION_BADGE: Record<ReturnDecision, string> = {
  return_to_stock:    'bg-green-600 text-white border-green-700',
  store_for_handling: 'bg-amber-500 text-white border-amber-600',
  discard:            'bg-red-600   text-white border-red-700',
  repackage:          'bg-blue-500  text-white border-blue-600',
  reship:             'bg-blue-600  text-white border-blue-700',
}

export const DECISION_META: Record<ReturnDecision, {
  label:        string
  badge:        string
  description?: string
  descStyle?:   string
}> = {
  return_to_stock: {
    label:       DECISION_LABELS.return_to_stock,
    badge:       DECISION_BADGE.return_to_stock,
    description: 'Produto avaliado como saudável e em condições de revenda. Será reintegrado ao estoque disponível para venda imediata.',
    descStyle:   'bg-green-50 border-green-200 text-green-800',
  },
  store_for_handling: {
    label:       DECISION_LABELS.store_for_handling,
    badge:       DECISION_BADGE.store_for_handling,
    description: 'O produto será encaminhado para área segregada dentro do galpão para tratativas futuras. Procure o departamento comercial da Logvale para definir as próximas ações.',
    descStyle:   'bg-amber-50 border-amber-200 text-amber-800',
  },
  discard: {
    label:       DECISION_LABELS.discard,
    badge:       DECISION_BADGE.discard,
    description: 'O produto ficará disponível para retirada pelo cliente. Os termos, prazos e condições da retirada são negociados diretamente entre o cliente e o departamento comercial da Logvale.',
    descStyle:   'bg-red-50 border-red-200 text-red-800',
  },
  repackage: {
    label: DECISION_LABELS.repackage,
    badge: DECISION_BADGE.repackage,
  },
  reship: {
    label:       DECISION_LABELS.reship,
    badge:       DECISION_BADGE.reship,
    description: 'O mesmo pedido será reenviado ao cliente final com a mesma NF do pedido original. Anexe a etiqueta de reenvio e a DANFE (PDFs) para a Logvale despachar.',
    descStyle:   'bg-blue-50 border-blue-200 text-blue-800',
  },
}

/**
 * "Reenvio" é exclusiva de alguns depositantes (RESHIP_DEPOSITOR_CNPJS — hoje
 * a Blackskull). Puro de propósito: o app avalia com `env.reshipDepositorCnpjs`
 * no servidor; o client component só recebe o booleano já calculado na row.
 */
export function isReshipDepositor(
  cnpj: string | null | undefined,
  allowedCnpjs: readonly string[],
): boolean {
  if (!cnpj) return false
  return allowedCnpjs.includes(cnpj.replace(/\D/g, ''))
}
