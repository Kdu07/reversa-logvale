'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Building2, CalendarRange, Loader2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { customRangeError, dashboardHref } from '@/lib/admin-dashboard/filters'
import { DASHBOARD_PERIODS, type DashboardPeriodKey } from '@/lib/admin-dashboard/types'

interface Props {
  period:            DashboardPeriodKey
  from:              string
  to:                string
  depositorId:       string | null
  /** Mantido na URL ao trocar os filtros do período. */
  urgentDepositorId: string | null
  depositors:        { id: string; name: string }[]
  /** Hoje em São Paulo ("YYYY-MM-DD") — limite do seletor de datas. */
  today:             string
  /** Erro de um período personalizado inválido vindo da URL. */
  serverError?:      string | null
}

/**
 * Filtros dos blocos "No período": atalhos de período, intervalo personalizado
 * (De/Até + Aplicar) e depositante. Tudo vai para a URL — o servidor recalcula.
 */
export function PeriodFilterBar({
  period, from, to, depositorId, urgentDepositorId, depositors, today, serverError,
}: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [showCustom, setShowCustom] = useState(period === 'custom')
  const [draftFrom, setDraftFrom] = useState(from)
  const [draftTo, setDraftTo] = useState(to)
  const [error, setError] = useState<string | null>(null)

  function go(next: { period?: DashboardPeriodKey; from?: string; to?: string; depositorId?: string | null }) {
    const href = dashboardHref({
      period:            next.period ?? period,
      from:              next.from ?? from,
      to:                next.to ?? to,
      depositorId:       next.depositorId !== undefined ? next.depositorId : depositorId,
      urgentDepositorId,
    })
    startTransition(() => router.push(href, { scroll: false }))
  }

  function applyCustom() {
    const err = customRangeError(draftFrom, draftTo)
    setError(err)
    if (!err) go({ period: 'custom', from: draftFrom, to: draftTo })
  }

  const customOpen = showCustom || period === 'custom'
  const message    = error ?? serverError ?? null

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {/* Atalhos de período */}
        <div role="group" aria-label="Período" className="inline-flex flex-wrap rounded-lg border bg-muted/40 p-0.5">
          {DASHBOARD_PERIODS.map((p) => {
            const active = p.key === 'custom' ? customOpen : p.key === period && !showCustom
            return (
              <button
                key={p.key}
                type="button"
                aria-pressed={active}
                onClick={() => {
                  setError(null)
                  if (p.key === 'custom') {
                    setDraftFrom(from)
                    setDraftTo(to)
                    setShowCustom(true)
                    return
                  }
                  setShowCustom(false)
                  go({ period: p.key })
                }}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium transition-colors',
                  active ? 'bg-card text-foreground shadow-elev-sm' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {p.key === 'custom' && <CalendarRange className="h-3.5 w-3.5" />}
                {p.label}
              </button>
            )
          })}
        </div>

        {/* Depositante */}
        <div className="relative">
          {pending ? (
            <Loader2 className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-muted-foreground" />
          ) : (
            <Building2 className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          )}
          <select
            aria-label="Filtrar o período por depositante"
            value={depositorId ?? ''}
            onChange={(e) => go({ depositorId: e.target.value || null })}
            className={cn(
              'h-8 max-w-[14rem] rounded-md border border-input bg-background pl-8 pr-2 text-xs font-medium',
              'focus:outline-none focus:ring-2 focus:ring-ring',
              depositorId && 'border-primary/50 text-foreground',
              pending && 'opacity-70',
            )}
          >
            <option value="">Todos os depositantes</option>
            {depositors.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>

        {depositorId && (
          <button
            type="button"
            onClick={() => go({ depositorId: null })}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <X className="h-3 w-3" />
            Limpar depositante
          </button>
        )}
      </div>

      {/* Intervalo personalizado */}
      {customOpen && (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            applyCustom()
          }}
          className="flex flex-wrap items-end gap-2 rounded-lg border bg-muted/30 p-2.5"
        >
          <label className="space-y-1">
            <span className="block text-[11px] font-medium uppercase tracking-wider text-muted-foreground">De</span>
            <input
              type="date"
              value={draftFrom}
              max={draftTo || today}
              onChange={(e) => setDraftFrom(e.target.value)}
              className="h-8 rounded-md border border-input bg-background px-2 text-xs tabular-nums focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </label>
          <label className="space-y-1">
            <span className="block text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Até</span>
            <input
              type="date"
              value={draftTo}
              min={draftFrom || undefined}
              max={today}
              onChange={(e) => setDraftTo(e.target.value)}
              className="h-8 rounded-md border border-input bg-background px-2 text-xs tabular-nums focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </label>
          <Button type="submit" size="sm" className="h-8" disabled={pending}>
            Aplicar
          </Button>
          {period !== 'custom' && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-8"
              onClick={() => {
                setShowCustom(false)
                setError(null)
              }}
            >
              Cancelar
            </Button>
          )}
        </form>
      )}

      {message && <p role="alert" className="text-xs text-destructive">{message}</p>}
    </div>
  )
}
