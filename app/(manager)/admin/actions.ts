'use server'

import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/supabase/get-current-user'
import type { ReturnStatus, ReturnDecision } from '@/types'

export type DashboardPeriod = 'today' | '7d' | '30d'

export interface DashboardStats {
  totals: { today: number; last7d: number; last30d: number }
  byStatus: { status: ReturnStatus; count: number }[]
  byDecision: { decision: ReturnDecision; count: number }[]
  avgDecisionHours: number | null
  avgProcessHours:  number | null
  autoRate:         number | null
  topClients:       { name: string; count: number }[]
  urgentPending:    { id: string; rv: string; receivedAt: string; depositorName: string | null }[]
}

export async function getDashboardStatsAction(): Promise<DashboardStats | { error: string }> {
  try {
    const user = await getCurrentUser()
    if (user.profile.role !== 'manager') return { error: 'Acesso negado' }

    const supabase = createClient()
    const now = new Date()
    const d1  = new Date(now.getTime() - 1  * 24 * 60 * 60 * 1000).toISOString()
    const d7  = new Date(now.getTime() - 7  * 24 * 60 * 60 * 1000).toISOString()
    const d30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const d48 = new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString()

    const [
      { count: today },
      { count: last7d },
      { count: last30d },
      { count: awaiting },
      { count: decided },
      { count: processed },
      { count: rts },
      { count: sfh },
      { count: disc },
      { count: repk },
      { data: timingRows },
      { data: autoRows },
      { data: clientRows },
      { data: urgentRows },
    ] = await Promise.all([
      supabase.from('returns').select('*', { count: 'exact', head: true }).gte('received_at', d1),
      supabase.from('returns').select('*', { count: 'exact', head: true }).gte('received_at', d7),
      supabase.from('returns').select('*', { count: 'exact', head: true }).gte('received_at', d30),
      supabase.from('returns').select('*', { count: 'exact', head: true }).eq('status', 'awaiting_decision'),
      supabase.from('returns').select('*', { count: 'exact', head: true }).eq('status', 'decided'),
      supabase.from('returns').select('*', { count: 'exact', head: true }).eq('status', 'processed'),
      supabase.from('returns').select('*', { count: 'exact', head: true }).eq('decision', 'return_to_stock'),
      supabase.from('returns').select('*', { count: 'exact', head: true }).eq('decision', 'store_for_handling'),
      supabase.from('returns').select('*', { count: 'exact', head: true }).eq('decision', 'discard'),
      supabase.from('returns').select('*', { count: 'exact', head: true }).eq('decision', 'repackage'),
      supabase.from('returns').select('received_at, decided_at, processed_at').not('decided_at', 'is', null).limit(500),
      supabase.from('returns').select('decided_by_type').not('decided_at', 'is', null).limit(1000),
      supabase.from('returns').select('profiles!decided_by(full_name)').eq('decided_by_type', 'client').not('decided_by', 'is', null).limit(1000),
      supabase.from('returns').select('id, rv, received_at, depositors!depositor_id(razao_social)').eq('status', 'awaiting_decision').lt('received_at', d48).order('received_at').limit(20),
    ])

    const byStatus: DashboardStats['byStatus'] = [
      { status: 'awaiting_decision', count: awaiting ?? 0 },
      { status: 'decided',           count: decided  ?? 0 },
      { status: 'processed',         count: processed ?? 0 },
    ]

    const byDecision: DashboardStats['byDecision'] = [
      { decision: 'return_to_stock',    count: rts  ?? 0 },
      { decision: 'store_for_handling', count: sfh  ?? 0 },
      { decision: 'discard',            count: disc ?? 0 },
      { decision: 'repackage',          count: repk ?? 0 },
    ]

    let avgDecisionHours: number | null = null
    let avgProcessHours:  number | null = null
    if (timingRows && timingRows.length > 0) {
      const decisionMs = timingRows
        .filter((r) => r.decided_at)
        .map((r) => new Date(r.decided_at as string).getTime() - new Date(r.received_at).getTime())
      if (decisionMs.length > 0)
        avgDecisionHours = Math.round(decisionMs.reduce((a, b) => a + b, 0) / decisionMs.length / 3600000 * 10) / 10

      const processMs = timingRows
        .filter((r) => r.processed_at && r.decided_at)
        .map((r) => new Date(r.processed_at as string).getTime() - new Date(r.decided_at as string).getTime())
      if (processMs.length > 0)
        avgProcessHours = Math.round(processMs.reduce((a, b) => a + b, 0) / processMs.length / 3600000 * 10) / 10
    }

    let autoRate: number | null = null
    if (autoRows && autoRows.length > 0) {
      const autoCount = autoRows.filter((r) => r.decided_by_type === 'auto').length
      autoRate = Math.round(autoCount / autoRows.length * 1000) / 10
    }

    const clientCounts = new Map<string, number>()
    for (const r of clientRows ?? []) {
      const name = (r.profiles as unknown as { full_name: string } | null)?.full_name ?? 'Desconhecido'
      clientCounts.set(name, (clientCounts.get(name) ?? 0) + 1)
    }
    const topClients = Array.from(clientCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, count]) => ({ name, count }))

    const urgentPending = (urgentRows ?? []).map((r) => ({
      id:            r.id,
      rv:            r.rv,
      receivedAt:    r.received_at,
      depositorName: (r.depositors as unknown as { razao_social: string } | null)?.razao_social ?? null,
    }))

    return {
      totals: { today: today ?? 0, last7d: last7d ?? 0, last30d: last30d ?? 0 },
      byStatus,
      byDecision,
      avgDecisionHours,
      avgProcessHours,
      autoRate,
      topClients,
      urgentPending,
    }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Erro interno' }
  }
}
