/**
 * Filtros da lista de devoluções do admin (`/admin/devolucoes`) lidos da URL —
 * helpers puros (sem Supabase). São os mesmos parâmetros que os links do
 * dashboard (`/admin`) montam, para o número clicado bater com a lista.
 *
 *   rv, status, page          — filtros que a tela já tinha
 *   depositor                 — UUID do depositante
 *   from, to                  — "YYYY-MM-DD", dias civis de São Paulo (received_at)
 *   decision                  — decisão do cliente/automática
 *   condition                 — good | damaged | empty | mismatched (Etapa 3)
 *   nokey=1                   — sem chave de acesso da NF de origem
 *   deadline                  — overdue | soon | urgent (só aguardando decisão,
 *                               depositantes com prazo; prazo = 72h a partir de
 *                               coalesce(decision_deadline_from, received_at))
 */
import { DECISION_LABELS, isReturnDecision } from '@/lib/decisions'
import { ITEM_CONDITION_FILTER_LABELS, isItemConditionFilter, type ItemConditionFilter } from '@/lib/operator-home'
import { uuidOrNull, brDate } from '@/lib/admin-dashboard/filters'
import type { ReturnDecision, ReturnStatus } from '@/types'

export type DeadlineFilter = 'overdue' | 'soon' | 'urgent'

export const DEADLINE_LABELS: Record<DeadlineFilter, string> = {
  overdue: 'Prazo vencido',
  soon:    'Vence em < 24h',
  urgent:  'Vencidas e a vencer',
}

const STATUSES: ReturnStatus[] = ['awaiting_decision', 'decided', 'processed']
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export interface AdminReturnsFilters {
  rv:          string
  status:      ReturnStatus | null
  page:        number
  depositorId: string | null
  from:        string | null
  to:          string | null
  decision:    ReturnDecision | null
  condition:   ItemConditionFilter | null
  noKey:       boolean
  deadline:    DeadlineFilter | null
}

export type AdminReturnsParams = Partial<Record<
  'rv' | 'status' | 'page' | 'depositor' | 'from' | 'to' | 'decision' | 'condition' | 'nokey' | 'deadline',
  string
>>

const isDeadline = (v: unknown): v is DeadlineFilter => v === 'overdue' || v === 'soon' || v === 'urgent'

export function parseAdminReturnsParams(sp: AdminReturnsParams): AdminReturnsFilters {
  const from = sp.from && DATE_RE.test(sp.from) ? sp.from : null
  const to   = sp.to   && DATE_RE.test(sp.to)   ? sp.to   : null
  return {
    rv:          (sp.rv ?? '').trim(),
    status:      STATUSES.includes(sp.status as ReturnStatus) ? (sp.status as ReturnStatus) : null,
    page:        Math.max(1, parseInt(sp.page ?? '1', 10) || 1),
    depositorId: uuidOrNull(sp.depositor),
    from,
    to,
    decision:    isReturnDecision(sp.decision) ? sp.decision : null,
    condition:   isItemConditionFilter(sp.condition) ? sp.condition : null,
    noKey:       sp.nokey === '1',
    deadline:    isDeadline(sp.deadline) ? sp.deadline : null,
  }
}

/** Monta a URL da lista; `page` só entra quando > 1. */
export function adminReturnsHref(f: Partial<AdminReturnsFilters>): string {
  const p = new URLSearchParams()
  if (f.rv)          p.set('rv', f.rv)
  if (f.status)      p.set('status', f.status)
  if (f.depositorId) p.set('depositor', f.depositorId)
  if (f.from)        p.set('from', f.from)
  if (f.to)          p.set('to', f.to)
  if (f.decision)    p.set('decision', f.decision)
  if (f.condition)   p.set('condition', f.condition)
  if (f.noKey)       p.set('nokey', '1')
  if (f.deadline)    p.set('deadline', f.deadline)
  if (f.page && f.page > 1) p.set('page', String(f.page))
  const qs = p.toString()
  return `/admin/devolucoes${qs ? `?${qs}` : ''}`
}

/** Filtros além de RV/status (os que vêm do dashboard), como chips removíveis. */
export function extraFilterChips(
  f: AdminReturnsFilters,
  depositorName: string | null,
): { key: string; label: string; href: string }[] {
  const without = (patch: Partial<AdminReturnsFilters>) => adminReturnsHref({ ...f, ...patch, page: 1 })
  const chips: { key: string; label: string; href: string }[] = []

  if (f.depositorId) chips.push({ key: 'depositor', label: depositorName ?? 'Depositante', href: without({ depositorId: null }) })
  if (f.from || f.to) {
    const label = f.from && f.to
      ? (f.from === f.to ? `Recebidas em ${brDate(f.from)}` : `Recebidas de ${brDate(f.from)} a ${brDate(f.to)}`)
      : f.from ? `Recebidas desde ${brDate(f.from)}` : `Recebidas até ${brDate(f.to!)}`
    chips.push({ key: 'period', label, href: without({ from: null, to: null }) })
  }
  if (f.decision)  chips.push({ key: 'decision',  label: DECISION_LABELS[f.decision], href: without({ decision: null }) })
  if (f.condition) chips.push({ key: 'condition', label: ITEM_CONDITION_FILTER_LABELS[f.condition], href: without({ condition: null }) })
  if (f.noKey)     chips.push({ key: 'nokey',     label: 'Sem chave de acesso', href: without({ noKey: false }) })
  if (f.deadline)  chips.push({ key: 'deadline',  label: DEADLINE_LABELS[f.deadline], href: without({ deadline: null }) })
  return chips
}

/** Valor entre aspas para a árvore lógica do PostgREST (datas têm `:` e `.`). */
const q = (v: string) => `"${v}"`

/**
 * Expressão para `.or()` do PostgREST que filtra pelo prazo de decisão —
 * `coalesce(decision_deadline_from, received_at)` não cabe num filtro simples.
 * Devolve `and(...)` como único termo do `or`, combinando:
 *   - base do prazo < limite superior (e >= inferior, em "soon");
 *   - depositante com prazo (sem depositante conta como com prazo, como no
 *     job_auto_decision).
 */
export function deadlineOrExpression(
  deadline: DeadlineFilter,
  now: Date,
  noDeadlineDepositorIds: string[],
): string {
  const h = (hours: number) => new Date(now.getTime() - hours * 3_600_000).toISOString()
  const before = (iso: string) =>
    `or(and(decision_deadline_from.is.null,received_at.lt.${q(iso)}),decision_deadline_from.lt.${q(iso)})`
  const atOrAfter = (iso: string) =>
    `or(and(decision_deadline_from.is.null,received_at.gte.${q(iso)}),decision_deadline_from.gte.${q(iso)})`

  const parts: string[] = []
  if (deadline === 'overdue') parts.push(before(h(72)))
  if (deadline === 'soon')    parts.push(before(h(48)), atOrAfter(h(72)))
  if (deadline === 'urgent')  parts.push(before(h(48)))
  if (noDeadlineDepositorIds.length > 0) {
    parts.push(`or(depositor_id.is.null,depositor_id.not.in.(${noDeadlineDepositorIds.join(',')}))`)
  }
  return `and(${parts.join(',')})`
}
