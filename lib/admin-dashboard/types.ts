/**
 * Contrato de dados do dashboard do admin (/admin).
 *
 * Preenchido pela RPC `get_admin_dashboard` (migration 025) via
 * `getAdminDashboardAction` → `mapAdminDashboard` (`rpc.ts`).
 *
 * - Período = dias civis de São Paulo, intervalo [from, to) (`lib/reports/period.ts`).
 * - `attention` NÃO depende do período: é a foto de agora.
 * - volume / quality / depositors = devoluções RECEBIDAS no período (mesmo
 *   critério do relatório mensal); team = atividade pela data em que aconteceu.
 * - Prazo de decisão = coalesce(decision_deadline_from, received_at) + 72h;
 *   depositantes com `no_decision_deadline` entram em `noDeadline`, nunca em vencidas.
 */
import type { IdentifierType, ReturnDecision } from '@/types'

export type DashboardPeriodKey = 'today' | '7d' | '30d' | 'month' | 'custom'

export const DASHBOARD_PERIODS: { key: DashboardPeriodKey; label: string }[] = [
  { key: 'today', label: 'Hoje' },
  { key: '7d',    label: '7 dias' },
  { key: '30d',   label: '30 dias' },
  { key: 'month', label: 'Este mês' },
  { key: 'custom', label: 'Personalizado' },
]

export function isDashboardPeriodKey(v: unknown): v is DashboardPeriodKey {
  return typeof v === 'string' && DASHBOARD_PERIODS.some((p) => p.key === v)
}

/** Valor do período atual + o mesmo recorte no período anterior (para a variação). */
export interface Compared {
  value:    number | null
  previous: number | null
}

export type ConditionKey = 'good' | 'damaged' | 'empty' | 'mismatched'

export type SeriesUnit = 'hour' | 'day' | 'week'

export interface AdminDashboardData {
  period: {
    key:           DashboardPeriodKey
    /** Intervalo aplicado, "YYYY-MM-DD", ambos inclusivos (preenche os campos De/Até). */
    from:          string
    to:            string
    /** "01/11/2026 a 17/11/2026" */
    label:         string
    /** "vs. 15/10 a 31/10" */
    previousLabel: string
    /** Depositante aplicado aos blocos do período (null = todos). */
    depositorId:   string | null
    depositorName: string | null
  }

  /** Depositantes ativos, para o filtro do período. */
  depositorOptions: { id: string; name: string }[]

  /** Foto de agora — independe do período. */
  attention: {
    awaiting: {
      total:      number
      onTime:     number
      /** Vence em menos de 24h. */
      dueSoon:    number
      overdue:    number
      /** Depositantes sem prazo (no_decision_deadline). */
      noDeadline: number
    }
    /** Decididas que ainda não viraram `processed`. */
    decidedBacklog: {
      total:       number
      oldestHours: number | null
      byDecision:  { decision: ReturnDecision; count: number }[]
    }
    withoutKey:     { awaiting: number; decided: number }
    /** Avisos de 48h enviados nas últimas 24h. */
    warnings24h:    number
    /**
     * Vencidas e a vencer (< 24h), mais urgentes primeiro. Já vem filtrada pelo
     * depositante escolhido (`?udep=`) e limitada (ex.: 20 linhas).
     */
    urgent: {
      id:            string
      rv:            string
      depositorId:   string | null
      depositorName: string | null
      /** Horas até o prazo; negativo = vencida há N horas. */
      hoursLeft:     number
    }[]
    /**
     * Opções do filtro do quadro: depositantes com alguma vencida/a vencer e
     * quantas cada um tem (contadas sem limite, independente do filtro aplicado).
     */
    urgentDepositors: { id: string; name: string; count: number }[]
    /** Depositante aplicado no quadro (null = todos). */
    urgentDepositorId: string | null
  }

  volume: {
    received:           Compared
    decidedByClient:    Compared
    decidedAuto:        Compared
    processed:          Compared
    medianDecisionHours: Compared
    medianProcessHours:  Compared
    /** Uma linha por hora ("Hoje"), por dia (até 62 dias) ou por semana (acima disso). */
    series:     { label: string; received: number }[]
    seriesUnit: SeriesUnit
    byDecision: { decision: ReturnDecision; count: number }[]
  }

  quality: {
    /**
     * `items`: Bom = itens recebidos; Avaria = itens avariados;
     * Não corresponde = itens que não correspondem; Caixa vazia = 0.
     */
    conditions:     { condition: ConditionKey; returns: number; items: number }[]
    /** Recebidas antes da etapa de estado existir (damaged_item_count nulo). */
    notEvaluated:   number
    /** Soma de item_count das recebidas no período. */
    totalItems:     number
    identification: { type: IdentifierType; count: number }[]
  }

  /** Recebidas no período por depositante (`awaiting` = aguardando agora). */
  depositors: {
    id:                  string
    name:                string
    received:            number
    awaiting:            number
    autoRate:            number | null
    medianDecisionHours: number | null
    damagedRate:         number | null
    noDeadline:          boolean
  }[]

  team: {
    id:        string
    name:      string
    received:  number
    processed: number
    edits:     number
  }[]
}
