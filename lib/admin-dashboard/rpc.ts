/**
 * Converte a resposta da RPC `get_admin_dashboard` (migration 025) no formato
 * da página (`AdminDashboardData`). Função pura — sem Supabase — para ser
 * testada isoladamente; a action só chama a RPC e repassa o resultado.
 */
import { DECISION_LABELS } from '@/lib/decisions'
import { periodLabels, seriesUnit, type DashboardFilters } from './filters'
import type { AdminDashboardData, Compared, ConditionKey } from './types'
import type { IdentifierType, ReturnDecision } from '@/types'

type Num = number | string | null | undefined

interface RawKpis {
  received?:            Num
  decidedByClient?:     Num
  decidedAuto?:         Num
  processed?:           Num
  medianDecisionHours?: Num
  medianProcessHours?:  Num
}

export interface AdminDashboardRpc {
  attention: {
    awaiting:         { total: Num; onTime: Num; dueSoon: Num; overdue: Num; noDeadline: Num }
    decidedBacklog:   { total: Num; oldestHours: Num; byDecision: { decision: string; count: Num }[] }
    withoutKey:       { awaiting: Num; decided: Num }
    warnings24h:      Num
    urgent:           { id: string; rv: string; depositorId: string | null; depositorName: string | null; hoursLeft: Num }[]
    urgentDepositors: { id: string; name: string; count: Num }[]
  }
  volume: {
    current:    RawKpis
    previous:   RawKpis
    series:     { start: string; received: Num }[]
    byDecision: { decision: string; count: Num }[]
  }
  quality: {
    conditions: Record<ConditionKey, { returns: Num; items: Num }> & { notEvaluated: Num; totalItems: Num }
    identification: { type: string; count: Num }[]
  }
  depositors: {
    id: string; name: string; noDeadline: boolean
    received: Num; awaiting: Num; autoRate: Num; medianDecisionHours: Num; damagedRate: Num
  }[]
  team:             { id: string; name: string; received: Num; processed: Num; edits: Num }[]
  depositorOptions: { id: string; name: string }[]
}

/** jsonb → number: bigint/numeric podem vir como string; ausente vira 0. */
const int = (v: Num): number => {
  const n = Number(v ?? 0)
  return Number.isFinite(n) ? n : 0
}
const numOrNull = (v: Num): number | null => {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

const CONDITIONS: ConditionKey[] = ['good', 'damaged', 'empty', 'mismatched']

const isDecision = (v: string): v is ReturnDecision => v in DECISION_LABELS

function compared(cur: RawKpis, prev: RawKpis, key: keyof RawKpis, kind: 'count' | 'hours'): Compared {
  return kind === 'count'
    ? { value: int(cur[key]), previous: int(prev[key]) }
    : { value: numOrNull(cur[key]), previous: numOrNull(prev[key]) }
}

/** "2026-11-17T14:00" → "14h" | "17/11" | "sem. 17/11". */
export function seriesLabel(start: string, unit: AdminDashboardData['volume']['seriesUnit']): string {
  const [date, time = '00:00'] = start.split('T')
  const [, m, d] = date.split('-')
  if (unit === 'hour') return `${time.slice(0, 2)}h`
  return unit === 'week' ? `sem. ${d}/${m}` : `${d}/${m}`
}

export function mapAdminDashboard(raw: AdminDashboardRpc, f: DashboardFilters): AdminDashboardData {
  const { attention, volume, quality } = raw
  const cur  = volume.current  ?? {}
  const prev = volume.previous ?? {}
  const unit = seriesUnit(f)
  const options = raw.depositorOptions ?? []
  const depositorName = f.depositorId
    ? options.find((o) => o.id === f.depositorId)?.name ?? 'Depositante selecionado'
    : null

  return {
    period: {
      key: f.period,
      from: f.from,
      to: f.to,
      ...periodLabels(f),
      depositorId: f.depositorId,
      depositorName,
    },

    depositorOptions: options,

    attention: {
      awaiting: {
        total:      int(attention.awaiting.total),
        onTime:     int(attention.awaiting.onTime),
        dueSoon:    int(attention.awaiting.dueSoon),
        overdue:    int(attention.awaiting.overdue),
        noDeadline: int(attention.awaiting.noDeadline),
      },
      decidedBacklog: {
        total:       int(attention.decidedBacklog.total),
        oldestHours: numOrNull(attention.decidedBacklog.oldestHours),
        byDecision:  (attention.decidedBacklog.byDecision ?? [])
          .filter((b) => isDecision(b.decision))
          .map((b) => ({ decision: b.decision as ReturnDecision, count: int(b.count) })),
      },
      withoutKey:  { awaiting: int(attention.withoutKey.awaiting), decided: int(attention.withoutKey.decided) },
      warnings24h: int(attention.warnings24h),
      urgent: (attention.urgent ?? []).map((u) => ({
        id:            u.id,
        rv:            u.rv,
        depositorId:   u.depositorId,
        depositorName: u.depositorName,
        hoursLeft:     numOrNull(u.hoursLeft) ?? 0,
      })),
      urgentDepositors: (attention.urgentDepositors ?? []).map((d) => ({ id: d.id, name: d.name, count: int(d.count) })),
      urgentDepositorId: f.urgentDepositorId,
    },

    volume: {
      received:            compared(cur, prev, 'received', 'count'),
      decidedByClient:     compared(cur, prev, 'decidedByClient', 'count'),
      decidedAuto:         compared(cur, prev, 'decidedAuto', 'count'),
      processed:           compared(cur, prev, 'processed', 'count'),
      medianDecisionHours: compared(cur, prev, 'medianDecisionHours', 'hours'),
      medianProcessHours:  compared(cur, prev, 'medianProcessHours', 'hours'),
      series: (volume.series ?? []).map((p) => ({ label: seriesLabel(p.start, unit), received: int(p.received) })),
      seriesUnit: unit,
      byDecision: (volume.byDecision ?? [])
        .filter((b) => isDecision(b.decision))
        .map((b) => ({ decision: b.decision as ReturnDecision, count: int(b.count) })),
    },

    quality: {
      conditions: CONDITIONS.map((c) => ({
        condition: c,
        returns:   int(quality.conditions?.[c]?.returns),
        items:     int(quality.conditions?.[c]?.items),
      })),
      notEvaluated:   int(quality.conditions?.notEvaluated),
      totalItems:     int(quality.conditions?.totalItems),
      identification: (quality.identification ?? []).map((i) => ({ type: i.type as IdentifierType, count: int(i.count) })),
    },

    depositors: (raw.depositors ?? []).map((d) => ({
      id:                  d.id,
      name:                d.name,
      received:            int(d.received),
      awaiting:            int(d.awaiting),
      autoRate:            numOrNull(d.autoRate),
      medianDecisionHours: numOrNull(d.medianDecisionHours),
      damagedRate:         numOrNull(d.damagedRate),
      noDeadline:          !!d.noDeadline,
    })),

    team: (raw.team ?? []).map((t) => ({
      id: t.id, name: t.name,
      received: int(t.received), processed: int(t.processed), edits: int(t.edits),
    })),
  }
}
