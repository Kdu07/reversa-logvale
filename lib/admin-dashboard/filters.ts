/**
 * Filtros do dashboard do admin lidos da URL — helpers puros (sem Supabase).
 *
 * Parâmetros:
 *   period = today | 7d | 30d | month | custom   (padrão: month)
 *   from, to = "YYYY-MM-DD" (só com period=custom; ambos inclusivos)
 *   dep  = depositante dos blocos "No período"
 *   udep = depositante do quadro "Vencidas e a vencer"
 *
 * Datas são dias civis de São Paulo; o intervalo enviado ao banco é
 * [startOfDay(from), startOfDay(to + 1)) — ver `lib/reports/period.ts`.
 */
import { APP_TZ_OFFSET, MAX_PERIOD_DAYS, TZ_SHIFT_MS, todayValue } from '@/lib/reports/period'
import { isDashboardPeriodKey, type DashboardPeriodKey, type SeriesUnit } from './types'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const pad = (n: number) => String(n).padStart(2, '0')

export function addDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1, d + days))
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`
}

/** Dias entre duas datas, inclusivo nas duas pontas. */
export function daysInclusive(from: string, to: string): number {
  const [fy, fm, fd] = from.split('-').map(Number)
  const [ty, tm, td] = to.split('-').map(Number)
  return (Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86_400_000 + 1
}

function isValidDate(v: string): boolean {
  if (!DATE_RE.test(v)) return false
  const [y, m, d] = v.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1, d))
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d
}

export const brDate  = (iso: string) => iso.split('-').reverse().join('/')
export const brShort = (iso: string) => iso.split('-').reverse().slice(0, 2).join('/')

/** Valida um intervalo personalizado; devolve a mensagem de erro ou null. */
export function customRangeError(from: string, to: string): string | null {
  if (!isValidDate(from) || !isValidDate(to)) return 'Informe as duas datas do período.'
  if (from > to) return 'A data inicial não pode ser posterior à final.'
  if (daysInclusive(from, to) > MAX_PERIOD_DAYS) return `O período não pode passar de ${MAX_PERIOD_DAYS} dias.`
  return null
}

export interface DashboardFilters {
  period:            DashboardPeriodKey
  /** Intervalo resolvido, "YYYY-MM-DD", ambos inclusivos. */
  from:              string
  to:                string
  /** Mesmo número de dias, imediatamente antes (para a variação). */
  previousFrom:      string
  previousTo:        string
  /**
   * Período que inclui hoje ainda está em andamento: o anterior é cortado no
   * mesmo tempo decorrido desde o início (ex.: "Hoje" às 15h vs. ontem até as
   * 15h), senão a variação compara um dia pela metade com um dia inteiro.
   * Instante ISO (UTC) que fecha o anterior, exclusivo; null = período fechado.
   */
  previousCutAt:     string | null
  depositorId:       string | null
  urgentDepositorId: string | null
  /** Período personalizado inválido na URL → caiu em "Este mês" e mostra o aviso. */
  periodError:       string | null
}

/** Id de depositante vindo da URL; algo que não é UUID quebraria a query. */
export const uuidOrNull = (v: string | undefined) => (v && UUID_RE.test(v) ? v : null)

export function resolveDashboardFilters(
  params: { period?: string; from?: string; to?: string; dep?: string; udep?: string },
  now: Date = new Date(),
): DashboardFilters {
  const today = todayValue(now)

  let period: DashboardPeriodKey = isDashboardPeriodKey(params.period) ? params.period : 'month'
  let periodError: string | null = null
  let from: string
  let to = today

  if (period === 'custom') {
    const err = customRangeError(params.from ?? '', params.to ?? '')
    if (err) {
      periodError = err
      period = 'month'
    }
  }

  switch (period) {
    case 'today':  from = today; break
    case '7d':     from = addDays(today, -6); break
    case '30d':    from = addDays(today, -29); break
    case 'custom': from = params.from!; to = params.to!; break
    default:       from = `${today.slice(0, 8)}01`
  }

  const len          = daysInclusive(from, to)
  const previousFrom = addDays(from, -len)
  return {
    period, from, to,
    previousFrom,
    previousTo:    addDays(from, -1),
    previousCutAt: to >= today ? previousCutInstant(from, previousFrom, now) : null,
    depositorId:       uuidOrNull(params.dep),
    urgentDepositorId: uuidOrNull(params.udep),
    periodError,
  }
}

/** Monta a URL do dashboard a partir dos filtros (só grava o que difere do padrão). */
export function dashboardHref(f: Pick<DashboardFilters, 'period' | 'from' | 'to' | 'depositorId' | 'urgentDepositorId'>): string {
  const p = new URLSearchParams()
  if (f.period !== 'month') p.set('period', f.period)
  if (f.period === 'custom') {
    p.set('from', f.from)
    p.set('to', f.to)
  }
  if (f.depositorId)       p.set('dep', f.depositorId)
  if (f.urgentDepositorId) p.set('udep', f.urgentDepositorId)
  const qs = p.toString()
  return `/admin${qs ? `?${qs}` : ''}`
}

/** Agrupamento do gráfico: por hora no "Hoje", por dia até 62 dias, por semana acima. */
export function seriesUnit(f: Pick<DashboardFilters, 'period' | 'from' | 'to'>): SeriesUnit {
  if (f.period === 'today') return 'hour'
  return daysInclusive(f.from, f.to) <= 62 ? 'day' : 'week'
}

function startOfDay(isoDate: string): string {
  return `${isoDate}T00:00:00${APP_TZ_OFFSET}`
}

/**
 * Fim do período anterior com o mesmo tempo decorrido do atual até `now`.
 * Pelo menos 1 minuto: a RPC recusa intervalo vazio (meia-noite em ponto).
 */
function previousCutInstant(from: string, previousFrom: string, now: Date): string {
  const elapsed = Math.max(now.getTime() - Date.parse(startOfDay(from)), 60_000)
  return new Date(Date.parse(startOfDay(previousFrom)) + elapsed).toISOString()
}

/** Instante ISO → dia e hora de São Paulo ("2026-11-16", "15h00"). */
function civilDateTime(iso: string): { date: string; time: string } {
  const t = new Date(Date.parse(iso) - TZ_SHIFT_MS)
  return {
    date: `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`,
    time: `${pad(t.getUTCHours())}h${pad(t.getUTCMinutes())}`,
  }
}

/** Argumentos da RPC `get_admin_dashboard` — limites [from, to) em São Paulo. */
export function dashboardRpcArgs(f: DashboardFilters) {
  return {
    p_from:             startOfDay(f.from),
    p_to:               startOfDay(addDays(f.to, 1)),
    p_prev_from:        startOfDay(f.previousFrom),
    p_prev_to:          f.previousCutAt ?? startOfDay(addDays(f.previousTo, 1)),
    p_depositor:        f.depositorId,
    p_urgent_depositor: f.urgentDepositorId,
    p_bucket:           seriesUnit(f),
  }
}

/** "01/11/2026 a 17/11/2026" e "vs. 15/10 a 31/10" (+ " até 15h00" se o anterior foi cortado). */
export function periodLabels(f: Pick<DashboardFilters, 'from' | 'to' | 'previousFrom' | 'previousTo' | 'previousCutAt'>) {
  const cut     = f.previousCutAt ? civilDateTime(f.previousCutAt) : null
  const prevEnd = cut?.date ?? f.previousTo
  const range   = f.previousFrom === prevEnd
    ? `vs. ${brShort(f.previousFrom)}`
    : `vs. ${brShort(f.previousFrom)} a ${brShort(prevEnd)}`
  return {
    label: f.from === f.to ? brDate(f.from) : `${brDate(f.from)} a ${brDate(f.to)}`,
    previousLabel: cut ? `${range} até ${cut.time}` : range,
  }
}
