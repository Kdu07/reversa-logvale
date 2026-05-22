import type { ReturnDecision } from '@/types'
import { ptBR } from '@/lib/i18n/pt-BR'

export const DECISION_LABELS: Record<ReturnDecision, string> = {
  return_to_stock:    ptBR.decisions.return_to_stock,
  store_for_handling: ptBR.decisions.store_for_handling,
  discard:            ptBR.decisions.discard,
  repackage:          ptBR.decisions.repackage,
}

export const DECISION_SHORT: Record<ReturnDecision, string> = {
  return_to_stock:    'Estoque',
  store_for_handling: 'Armazén.',
  discard:            'Descarte',
  repackage:          'Reembal.',
}

export const DECISION_TONE: Record<ReturnDecision, 'success' | 'warning' | 'destructive' | 'info'> = {
  return_to_stock:    'success',
  store_for_handling: 'warning',
  discard:            'destructive',
  repackage:          'info',
}

export const DECISION_BADGE: Record<ReturnDecision, string> = {
  return_to_stock:    'bg-green-100 text-green-800 border-green-300',
  store_for_handling: 'bg-amber-100 text-amber-800 border-amber-300',
  discard:            'bg-red-100   text-red-800   border-red-300',
  repackage:          'bg-blue-100  text-blue-800  border-blue-300',
}

export const DECISION_META: Record<ReturnDecision, { label: string; badge: string }> = {
  return_to_stock:    { label: DECISION_LABELS.return_to_stock,    badge: DECISION_BADGE.return_to_stock    },
  store_for_handling: { label: DECISION_LABELS.store_for_handling, badge: DECISION_BADGE.store_for_handling },
  discard:            { label: DECISION_LABELS.discard,            badge: DECISION_BADGE.discard            },
  repackage:          { label: DECISION_LABELS.repackage,          badge: DECISION_BADGE.repackage          },
}
