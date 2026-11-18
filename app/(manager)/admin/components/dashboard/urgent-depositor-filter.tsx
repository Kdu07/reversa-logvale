'use client'

import { useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Building2, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  depositors: { id: string; name: string; count: number }[]
  /** Depositante aplicado ('' = todos). */
  current:    string
}

/**
 * Filtro de depositante do quadro "Vencidas e a vencer" (`/admin?udep=`).
 * Mantém os outros parâmetros da URL (ex.: `period`).
 */
export function UrgentDepositorFilter({ depositors, current }: Props) {
  const router   = useRouter()
  const pathname = usePathname()
  const params   = useSearchParams()
  const [pending, startTransition] = useTransition()

  return (
    <div className="relative">
      {pending ? (
        <Loader2 className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-muted-foreground" />
      ) : (
        <Building2 className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
      )}
      <select
        aria-label="Filtrar vencidas e a vencer por depositante"
        value={current}
        onChange={(e) => {
          const next = new URLSearchParams(params.toString())
          if (e.target.value) next.set('udep', e.target.value)
          else next.delete('udep')
          const qs = next.toString()
          startTransition(() => {
            router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
          })
        }}
        className={cn(
          'h-8 max-w-[13rem] rounded-md border border-input bg-background pl-8 pr-2 text-xs font-medium',
          'focus:outline-none focus:ring-2 focus:ring-ring',
          pending && 'opacity-70',
        )}
      >
        <option value="">Todos os depositantes</option>
        {current && !depositors.some((d) => d.id === current) && (
          <option value={current}>Depositante selecionado (0)</option>
        )}
        {depositors.map((d) => (
          <option key={d.id} value={d.id}>{d.name} ({d.count})</option>
        ))}
      </select>
    </div>
  )
}
