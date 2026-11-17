'use server'

import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/supabase/get-current-user'
import { RETURN_DECISIONS } from '@/lib/decisions'
import { operatorHomeRanges, type OperatorHomeRanges } from '@/lib/operator-home'
import { dayBoundaryIso } from '@/lib/reports/period'
import type { ReturnDecision } from '@/types'

export interface RecentTratativa {
  id:            string
  rv:            string
  decision:      ReturnDecision
  decidedAt:     string
  depositorName: string | null
}

export interface OperatorHomeStats {
  /** Períodos usados nos contadores (dias civis de São Paulo), para os links. */
  ranges: OperatorHomeRanges
  /** Recebidas pelo próprio operador. Avaria/Caixa vazia são do mês corrente. */
  mine: {
    today:        number
    month:        number
    damagedMonth: number
    emptyMonth:   number
  }
  tratativas: {
    /** Devoluções `decided` aguardando execução (todas, de qualquer depositante). */
    pending:            number
    processedTodayByMe: number
    /** Depositante aplicado ao quadro de tratativas (null = todos). */
    depositorId:        string | null
    /** Pendentes no quadro — já com o filtro de depositante. */
    filteredPending:    number
    byDecision:         Record<ReturnDecision, number>
    /** As decididas mais recentemente primeiro (com o filtro de depositante). */
    recent:             RecentTratativa[]
  }
  /** Aguardando decisão do cliente, de qualquer operador. */
  awaiting: {
    total:      number
    withoutKey: number
  }
}

const RECENT_LIMIT = 10

type CountResult = { count: number | null; error: { message: string } | null }

/** Resolve várias contagens em paralelo; qualquer erro do banco vira exceção. */
async function countAll<K extends string>(
  queries: Record<K, PromiseLike<CountResult>>,
): Promise<Record<K, number>> {
  const keys    = Object.keys(queries) as K[]
  const results = await Promise.all(keys.map((k) => queries[k]))
  const out     = {} as Record<K, number>
  keys.forEach((k, i) => {
    const res = results[i]
    if (res.error) throw new Error(res.error.message)
    out[k] = res.count ?? 0
  })
  return out
}

/** O embed many-to-one vem como objeto; tolera array por segurança. */
function depositorNameOf(embed: unknown): string | null {
  const dep = Array.isArray(embed) ? embed[0] : embed
  return (dep as { razao_social?: string } | null | undefined)?.razao_social ?? null
}

export interface OperatorHomeFilters {
  /** Filtra o quadro "Tratativas pendentes" (contagem por decisão + lista). */
  depositorId?: string
}

export async function getOperatorHomeStatsAction(
  filters: OperatorHomeFilters = {},
): Promise<OperatorHomeStats | { error: string }> {
  try {
    const user     = await getCurrentUser()
    const supabase = createClient()
    const ranges   = operatorHomeRanges()

    const todayStart  = dayBoundaryIso(ranges.today,      'start')!
    const monthStart  = dayBoundaryIso(ranges.monthStart, 'start')!
    const depositorId = filters.depositorId ?? null

    const head = () =>
      supabase.from('returns').select('id', { count: 'exact', head: true })
    const mine = () => head().eq('received_by', user.id)

    // Quadro de tratativas: pendentes, opcionalmente de um só depositante.
    const boardHead = () => {
      const q = head().eq('status', 'decided')
      return depositorId ? q.eq('depositor_id', depositorId) : q
    }
    const recentBase = supabase
      .from('returns')
      .select('id, rv, decision, decided_at, depositors!depositor_id(razao_social)', { count: 'exact' })
      .eq('status', 'decided')
    const recentQuery = (depositorId ? recentBase.eq('depositor_id', depositorId) : recentBase)
      .order('decided_at', { ascending: false })
      .limit(RECENT_LIMIT)

    const decisionQueries = {} as Record<ReturnDecision, PromiseLike<CountResult>>
    for (const d of RETURN_DECISIONS) {
      decisionQueries[d] = boardHead().eq('decision', d)
    }

    const [counts, byDecision, recentRes] = await Promise.all([
      countAll({
        today:              mine().gte('received_at', todayStart),
        month:              mine().gte('received_at', monthStart),
        damagedMonth:       mine().gte('received_at', monthStart).gt('damaged_item_count', 0),
        emptyMonth:         mine().gte('received_at', monthStart).eq('item_count', 0),
        pendingTotal:       head().eq('status', 'decided'),
        processedTodayByMe: head().eq('processed_by', user.id).gte('processed_at', todayStart),
        awaitingTotal:      head().eq('status', 'awaiting_decision'),
        awaitingWithoutKey: head().eq('status', 'awaiting_decision').is('access_key', null),
      }),
      countAll(decisionQueries),
      recentQuery,
    ])

    if (recentRes.error) throw new Error(recentRes.error.message)

    const recent: RecentTratativa[] = (recentRes.data ?? []).map((r) => ({
      id:            r.id,
      rv:            r.rv,
      decision:      r.decision as ReturnDecision,
      decidedAt:     r.decided_at,
      depositorName: depositorNameOf(r.depositors),
    }))

    return {
      ranges,
      mine: {
        today:        counts.today,
        month:        counts.month,
        damagedMonth: counts.damagedMonth,
        emptyMonth:   counts.emptyMonth,
      },
      tratativas: {
        pending:            counts.pendingTotal,
        processedTodayByMe: counts.processedTodayByMe,
        depositorId,
        filteredPending:    recentRes.count ?? 0,
        byDecision,
        recent,
      },
      awaiting: {
        total:      counts.awaitingTotal,
        withoutKey: counts.awaitingWithoutKey,
      },
    }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Erro ao carregar dados' }
  }
}
