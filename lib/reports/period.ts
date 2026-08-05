/**
 * Resolução do período de um relatório.
 *
 * `returns.received_at` é `timestamptz`: fechar o mês em UTC jogaria tudo que
 * entrou depois das 21h do último dia para o mês seguinte. Por isso todo limite
 * é montado com o offset de São Paulo (fixo em -03:00 — o Brasil não tem
 * horário de verão desde 2019) e o intervalo é [from, to) — `to` exclusivo.
 */

export const APP_TZ_OFFSET = '-03:00'

/** Milissegundos de defasagem de São Paulo em relação ao UTC. */
const TZ_SHIFT_MS = 3 * 60 * 60 * 1000

/** Teto de dias por relatório — protege contra exportações gigantes. */
export const MAX_PERIOD_DAYS = 366

export interface ReportPeriod {
  /** Início inclusivo, ISO com offset -03:00. */
  from:  string
  /** Fim exclusivo (00:00 do dia seguinte ao último), ISO com offset -03:00. */
  to:    string
  /** Rótulo humano: "01/07/2026 a 31/07/2026". */
  label: string
  /** Trecho do nome do arquivo: "2026-07" ou "20260701-20260731". */
  slug:  string
}

export type PeriodInput =
  | { kind: 'month';  year: number; month: number }
  | { kind: 'preset'; preset: PeriodPreset }
  | { kind: 'custom'; from: string; to: string }

export type PeriodPreset = 'current_month' | 'previous_month' | 'last_90d'

const pad = (n: number) => String(n).padStart(2, '0')

/** Data civil (ano/mês/dia) em São Paulo para um instante qualquer. */
function civilDate(at: Date): { year: number; month: number; day: number } {
  const shifted = new Date(at.getTime() - TZ_SHIFT_MS)
  return {
    year:  shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day:   shifted.getUTCDate(),
  }
}

/** "YYYY-MM-DD" somado de `days` dias, sem passar por fuso local. */
function addDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split('-').map(Number)
  const shifted = new Date(Date.UTC(y, m - 1, d + days))
  return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}`
}

/** Dias entre duas datas "YYYY-MM-DD" (inclusivo nas duas pontas). */
function daysBetween(from: string, to: string): number {
  const [fy, fm, fd] = from.split('-').map(Number)
  const [ty, tm, td] = to.split('-').map(Number)
  const diff = Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)
  return diff / 86_400_000 + 1
}

const startOfDay = (isoDate: string) => `${isoDate}T00:00:00${APP_TZ_OFFSET}`

const brDate = (isoDate: string) => isoDate.split('-').reverse().join('/')

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/**
 * Período a partir de duas datas civis "YYYY-MM-DD", ambas inclusivas.
 * `to` vira 00:00 do dia seguinte para que a comparação no banco seja `< to`.
 */
export function customPeriod(from: string, to: string): ReportPeriod {
  if (!DATE_RE.test(from) || !DATE_RE.test(to)) {
    throw new Error('Datas do período inválidas')
  }
  if (from > to) throw new Error('A data inicial não pode ser posterior à final')

  const days = daysBetween(from, to)
  if (days > MAX_PERIOD_DAYS) {
    throw new Error(`O período não pode passar de ${MAX_PERIOD_DAYS} dias`)
  }

  return {
    from:  startOfDay(from),
    to:    startOfDay(addDays(to, 1)),
    label: `${brDate(from)} a ${brDate(to)}`,
    slug:  `${from.replace(/-/g, '')}-${to.replace(/-/g, '')}`,
  }
}

/** Mês fechado de referência. `month` é 1–12. */
export function monthPeriod(year: number, month: number): ReportPeriod {
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    throw new Error('Ano do período inválido')
  }
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error('Mês do período inválido')
  }

  const first    = `${year}-${pad(month)}-01`
  const lastDay  = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const last     = `${year}-${pad(month)}-${pad(lastDay)}`

  return { ...customPeriod(first, last), slug: `${year}-${pad(month)}` }
}

/** Presets do formulário, sempre relativos a "agora" em São Paulo. */
export function presetPeriod(preset: PeriodPreset, now: Date = new Date()): ReportPeriod {
  const today = civilDate(now)

  if (preset === 'current_month')  return monthPeriod(today.year, today.month)
  if (preset === 'previous_month') {
    const year  = today.month === 1 ? today.year - 1 : today.year
    const month = today.month === 1 ? 12 : today.month - 1
    return monthPeriod(year, month)
  }

  // last_90d: 90 dias corridos terminando hoje (hoje incluído)
  const end   = `${today.year}-${pad(today.month)}-${pad(today.day)}`
  return customPeriod(addDays(end, -89), end)
}

/** Resolve o período escolhido no formulário. Lança `Error` se inválido. */
export function resolvePeriod(input: PeriodInput, now: Date = new Date()): ReportPeriod {
  if (input.kind === 'month')  return monthPeriod(input.year, input.month)
  if (input.kind === 'preset') return presetPeriod(input.preset, now)
  return customPeriod(input.from, input.to)
}

/** Mês anterior no formato do `<input type="month">` ("2026-07"). */
export function previousMonthValue(now: Date = new Date()): string {
  return presetPeriod('previous_month', now).slug
}

/** Hoje em São Paulo no formato do `<input type="date">` ("2026-08-04"). */
export function todayValue(now: Date = new Date()): string {
  const { year, month, day } = civilDate(now)
  return `${year}-${pad(month)}-${pad(day)}`
}
