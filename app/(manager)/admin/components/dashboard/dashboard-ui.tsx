import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { ArrowDownRight, ArrowRight, ArrowUpRight, Minus, type LucideIcon } from 'lucide-react'
import type { Compared } from '@/lib/admin-dashboard/types'

/** "21h", "3d 14h", "—" */
export function formatHours(h: number | null): string {
  if (h === null) return '—'
  const abs = Math.abs(Math.round(h))
  if (abs < 24) return `${abs}h`
  const d = Math.floor(abs / 24)
  const r = abs % 24
  return r ? `${d}d ${r}h` : `${d}d`
}

export const fmtInt = (v: number) => v.toLocaleString('pt-BR')
export const fmtPct = (v: number | null) =>
  v === null ? '—' : `${v.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`

export function Section({
  icon: Icon, title, description, children,
}: { icon: LucideIcon; title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Icon className="h-4 w-4 text-muted-foreground" />
          {title}
        </h2>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
      {children}
    </section>
  )
}

/** Cartão com título, subtítulo opcional e link "Ver todas" no canto. */
export function Panel({
  title, description, href, hrefLabel = 'Ver lista', actions, className, bodyClassName, children,
}: {
  title: string
  description?: string
  href?: string
  hrefLabel?: string
  /** Controles no cabeçalho (ex.: filtro), antes do link. */
  actions?: React.ReactNode
  className?: string
  bodyClassName?: string
  children: React.ReactNode
}) {
  return (
    <Card className={cn('flex flex-col overflow-hidden', className)}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-3.5">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
        </div>
        {(actions || href) && (
          <div className="flex flex-wrap items-center gap-3">
            {actions}
            {href && (
              <Link
                href={href}
                className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                {hrefLabel}
                <ArrowRight className="h-3 w-3" />
              </Link>
            )}
          </div>
        )}
      </div>
      <div className={cn('flex-1 p-5', bodyClassName)}>{children}</div>
    </Card>
  )
}

/**
 * Variação vs. período anterior. `better` diz qual direção é boa (ex.: tempo
 * de decisão menor é melhor) — só o ícone ganha cor, o texto fica neutro.
 */
export function Delta({ data, better = 'up' }: { data: Compared; better?: 'up' | 'down' }) {
  const { value, previous } = data
  if (value === null || previous === null || previous === 0) {
    return <span className="text-xs text-muted-foreground">sem comparação</span>
  }
  const pct = Math.round(((value - previous) / previous) * 100)
  if (pct === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <Minus className="h-3 w-3" /> estável
      </span>
    )
  }
  const up   = pct > 0
  const good = up === (better === 'up')
  const Icon = up ? ArrowUpRight : ArrowDownRight
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
      <Icon className={cn('h-3.5 w-3.5', good ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')} />
      <span className="tabular-nums text-foreground/80">{up ? '+' : ''}{pct}%</span>
    </span>
  )
}

/** KPI compacto do período: rótulo, valor e variação. */
export function KpiTile({
  label, value, data, better, hint,
}: { label: string; value: string; data: Compared; better?: 'up' | 'down'; hint?: string }) {
  return (
    <Card className="space-y-1.5 p-4">
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-2xl font-semibold tabular-nums tracking-tight text-foreground">{value}</p>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
        <Delta data={data} better={better} />
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      </div>
    </Card>
  )
}

export interface Segment {
  key:   string
  label: string
  value: number
  /** Classe de fundo completa (o Tailwind só gera o que é literal). */
  color: string
  href?: string
}

/**
 * Barra horizontal empilhada (partes de um todo) + legenda com valor e %.
 * Cada segmento tem `title` para o hover; a legenda garante que a cor nunca
 * seja a única pista.
 */
export function SegmentedBar({ segments, unit }: { segments: Segment[]; unit?: string }) {
  const total = segments.reduce((s, x) => s + x.value, 0)
  return (
    <div className="space-y-4">
      <div className="flex h-3 w-full gap-0.5 overflow-hidden rounded-full bg-muted">
        {total > 0 && segments.filter((s) => s.value > 0).map((s) => (
          <span
            key={s.key}
            title={`${s.label}: ${fmtInt(s.value)} (${Math.round((s.value / total) * 100)}%)`}
            className={cn('h-full first:rounded-l-full last:rounded-r-full', s.color)}
            style={{ width: `${(s.value / total) * 100}%` }}
          />
        ))}
      </div>
      <ul className="space-y-1.5">
        {segments.map((s) => {
          const row = (
            <>
              <span className="flex min-w-0 items-center gap-2 text-sm text-foreground">
                <span className={cn('h-2.5 w-2.5 shrink-0 rounded-sm', s.color)} />
                <span className="truncate">{s.label}</span>
              </span>
              <span className="flex items-baseline gap-2 tabular-nums">
                <span className="text-sm font-semibold text-foreground">{fmtInt(s.value)}</span>
                <span className="w-10 text-right text-xs text-muted-foreground">
                  {total > 0 ? `${Math.round((s.value / total) * 100)}%` : '—'}
                </span>
              </span>
            </>
          )
          const base = 'flex items-center justify-between gap-3 rounded-md px-2 py-1'
          return (
            <li key={s.key}>
              {s.href && s.value > 0 ? (
                <Link href={s.href} className={cn(base, '-mx-2 transition-colors hover:bg-muted/60')}>{row}</Link>
              ) : (
                <div className={cn(base, '-mx-2')}>{row}</div>
              )}
            </li>
          )
        })}
      </ul>
      {unit && (
        <p className="text-xs text-muted-foreground">
          Total: <span className="font-medium tabular-nums text-foreground">{fmtInt(total)}</span> {unit}
        </p>
      )}
    </div>
  )
}

/** Lista de barras horizontais (comparar magnitudes entre categorias). */
export function BarList({
  rows,
}: {
  rows: { key: string; label: React.ReactNode; value: number; color?: string; href?: string }[]
}) {
  const max   = Math.max(1, ...rows.map((r) => r.value))
  const total = rows.reduce((s, r) => s + r.value, 0)
  return (
    <ul className="space-y-3">
      {rows.map((r) => {
        const pct = total > 0 ? Math.round((r.value / total) * 100) : 0
        const body = (
          <>
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="min-w-0 truncate text-foreground">{r.label}</span>
              <span className="flex items-baseline gap-2 tabular-nums">
                <span className="font-semibold text-foreground">{fmtInt(r.value)}</span>
                <span className="w-9 text-right text-xs text-muted-foreground">{pct}%</span>
              </span>
            </div>
            <div className="mt-1.5 h-2 w-full rounded-full bg-muted">
              <div
                className={cn('h-full rounded-full', r.color ?? 'bg-sky-500/80 dark:bg-sky-400/80')}
                style={{ width: `${(r.value / max) * 100}%` }}
              />
            </div>
          </>
        )
        return (
          <li key={r.key} title={`${fmtInt(r.value)} (${pct}%)`}>
            {r.href ? (
              <Link href={r.href} className="-mx-2 block rounded-md px-2 py-1 transition-colors hover:bg-muted/60">{body}</Link>
            ) : (
              body
            )}
          </li>
        )
      })}
    </ul>
  )
}
