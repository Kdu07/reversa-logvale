'use server'

import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/supabase/get-current-user'
import type { ReturnStatus, ReturnDecision } from '@/types'

export type DashboardPeriod = 'today' | '7d' | '30d'

export interface DashboardStats {
  totals:           { today: number; last7d: number; last30d: number }
  byStatus:         { status: ReturnStatus; count: number }[]
  byDecision:       { decision: ReturnDecision; count: number }[]
  avgDecisionHours: number | null
  avgProcessHours:  number | null
  autoRate:         number | null
  topClients:       { name: string; count: number }[]
  urgentPending:    { id: string; rv: string; receivedAt: string; depositorName: string | null }[]
}

type StatsRpc = {
  counts: {
    today: number; last7d: number; last30d: number
    cnt_awaiting: number; cnt_decided: number; cnt_processed: number
    cnt_rts: number; cnt_sfh: number; cnt_disc: number; cnt_repk: number
    avg_decision_hours: number | null; avg_process_hours: number | null
    decided_total: number; decided_auto: number
  }
  topClients:    { name: string; count: number }[]
  urgentPending: { id: string; rv: string; receivedAt: string; depositorName: string | null }[]
}

export async function getDashboardStatsAction(): Promise<DashboardStats | { error: string }> {
  try {
    const user = await getCurrentUser()
    if (user.profile.role !== 'manager') return { error: 'Acesso negado' }

    const supabase = createClient()
    const now = new Date()
    const d1  = new Date(now.getTime() -  1 * 24 * 60 * 60 * 1000).toISOString()
    const d7  = new Date(now.getTime() -  7 * 24 * 60 * 60 * 1000).toISOString()
    const d30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const d48 = new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString()

    const { data, error } = await supabase.rpc('get_dashboard_stats', {
      p_d1: d1, p_d7: d7, p_d30: d30, p_d48: d48,
    })

    if (error) return { error: error.message }

    const { counts, topClients, urgentPending } = data as StatsRpc

    const autoRate = counts.decided_total > 0
      ? Math.round(counts.decided_auto / counts.decided_total * 1000) / 10
      : null

    return {
      totals: { today: counts.today, last7d: counts.last7d, last30d: counts.last30d },
      byStatus: [
        { status: 'awaiting_decision', count: counts.cnt_awaiting  },
        { status: 'decided',           count: counts.cnt_decided   },
        { status: 'processed',         count: counts.cnt_processed },
      ],
      byDecision: [
        { decision: 'return_to_stock',    count: counts.cnt_rts  },
        { decision: 'store_for_handling', count: counts.cnt_sfh  },
        { decision: 'discard',            count: counts.cnt_disc },
      ],
      avgDecisionHours: counts.avg_decision_hours,
      avgProcessHours:  counts.avg_process_hours,
      autoRate,
      topClients,
      urgentPending,
    }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Erro interno' }
  }
}
