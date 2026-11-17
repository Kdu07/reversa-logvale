'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Building2, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { TrativaDepositor } from '../tratativas/actions'

interface Props {
  depositors: TrativaDepositor[]
  /** Depositante aplicado ('' = todos). */
  current:    string
}

/** Filtro de depositante do quadro "Tratativas pendentes" da visão geral (`/operador?depositor=`). */
export function TratativasDepositorFilter({ depositors, current }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  return (
    <div className="relative">
      {pending ? (
        <Loader2 className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-muted-foreground" />
      ) : (
        <Building2 className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
      )}
      <select
        aria-label="Filtrar tratativas por depositante"
        value={current}
        onChange={(e) => {
          const id = e.target.value
          startTransition(() => {
            router.push(id ? `/operador?depositor=${id}` : '/operador', { scroll: false })
          })
        }}
        className={cn(
          'h-8 max-w-[15rem] rounded-md border border-input bg-background pl-8 pr-2 text-xs font-medium',
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
