'use server'

import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/supabase/get-current-user'
import type { ReturnDecision } from '@/types'

export interface UrgentTratativa {
  id:            string
  rv:            string
  decision:      ReturnDecision
  decidedAt:     string
  depositorName: string | null
}

export interface OperatorHomeStats {
  todayCount:       number
  weekCount:        number
  pendingCount:     number
  urgentTratativas: UrgentTratativa[]
}

export async function getOperatorHomeStatsAction(): Promise<
  OperatorHomeStats | { error: string }
> {
  try {
    const user     = await getCurrentUser()
    const supabase = createClient()
    const now      = new Date()

    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
    const weekAgo      = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()

    const [todayRes, weekRes, urgentRes] = await Promise.all([
      supabase
        .from('returns')
        .select('id', { count: 'exact', head: true })
        .eq('received_by', user.id)
        .gte('received_at', startOfToday),

      supabase
        .from('returns')
        .select('id', { count: 'exact', head: true })
        .eq('received_by', user.id)
        .gte('received_at', weekAgo),

      supabase
        .from('returns')
        .select('id, rv, decision, decided_at, depositors!depositor_id(razao_social)', {
          count: 'exact',
        })
        .eq('status', 'decided')
        .order('decided_at', { ascending: true })
        .limit(5),
    ])

    const urgentTratativas: UrgentTratativa[] = (urgentRes.data ?? []).map((r) => ({
      id:            r.id,
      rv:            r.rv,
      decision:      r.decision as ReturnDecision,
      decidedAt:     r.decided_at,
      depositorName: (r.depositors as { razao_social: string }[] | null)?.[0]?.razao_social ?? null,
    }))

    return {
      todayCount:       todayRes.count  ?? 0,
      weekCount:        weekRes.count   ?? 0,
      pendingCount:     urgentRes.count ?? 0,
      urgentTratativas,
    }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Erro ao carregar dados' }
  }
}
