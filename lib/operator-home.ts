/**
 * Visão geral do operador — helpers puros (sem Supabase) para os períodos dos
 * contadores e para os links que levam cada número à página onde ele aparece.
 *
 * Os períodos são dias civis de São Paulo (ver `lib/reports/period.ts`), os
 * mesmos que o filtro De/Até de "Minhas Devoluções" aplica — assim o número do
 * cartão bate com a lista aberta pelo clique.
 */
import { todayValue } from '@/lib/reports/period'
import type { ReturnDecision } from '@/types'

/** Filtro de estado no recebimento (Etapa 3). */
export type ItemConditionFilter = 'good' | 'damaged' | 'empty' | 'mismatched'

export const ITEM_CONDITION_FILTERS: readonly ItemConditionFilter[] = ['good', 'damaged', 'empty', 'mismatched']

export const ITEM_CONDITION_FILTER_LABELS: Record<ItemConditionFilter, string> = {
  good:    'Bom',
  damaged: 'Avaria',
  empty:   'Caixa vazia',
  mismatched: 'Produto não corresponde',
}

export function isItemConditionFilter(value: unknown): value is ItemConditionFilter {
  return typeof value === 'string' && (ITEM_CONDITION_FILTERS as readonly string[]).includes(value)
}

export interface OperatorHomeRanges {
  /** Hoje ("YYYY-MM-DD"). */
  today:      string
  /** Dia 1 do mês corrente. */
  monthStart: string
}

export function operatorHomeRanges(now: Date = new Date()): OperatorHomeRanges {
  const today = todayValue(now)
  return { today, monthStart: `${today.slice(0, 8)}01` }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Id de depositante vindo da URL; algo que não é UUID quebraria a query. */
export function parseDepositorParam(value: string | undefined): string | undefined {
  return value && UUID_RE.test(value) ? value : undefined
}

export interface MyReturnsLink {
  scope?:      'mine' | 'pending'
  from?:       string
  to?:         string
  condition?:  ItemConditionFilter
  withoutKey?: boolean
}

/** Link para "Minhas Devoluções" com os mesmos parâmetros que a página lê. */
export function myReturnsHref(link: MyReturnsLink = {}): string {
  const p = new URLSearchParams()
  if (link.scope === 'pending') p.set('scope', 'pending')
  if (link.from)       p.set('from', link.from)
  if (link.to)         p.set('to', link.to)
  if (link.condition)  p.set('condition', link.condition)
  if (link.withoutKey) p.set('nokey', '1')
  const qs = p.toString()
  return `/operador/minhas-devolucoes${qs ? `?${qs}` : ''}`
}

export interface TratativasLink {
  decision?:  ReturnDecision
  depositor?: string
  rv?:        string
  /** Id da devolução cujo modal de detalhes já abre ao carregar. */
  open?:      string
}

/** Link para "Tratativas" com os mesmos parâmetros que a página lê. */
export function tratativasHref(link: TratativasLink = {}): string {
  const p = new URLSearchParams()
  if (link.rv)        p.set('rv', link.rv)
  if (link.decision)  p.set('decision', link.decision)
  if (link.depositor) p.set('depositor', link.depositor)
  if (link.open)      p.set('open', link.open)
  const qs = p.toString()
  return `/operador/tratativas${qs ? `?${qs}` : ''}`
}
