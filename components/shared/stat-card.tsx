import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { ArrowUpRight, type LucideIcon } from 'lucide-react'

/** Poucos tons e suaves: volume (sky), atenção (amber), concluído (emerald), neutro (slate). */
export type StatAccent = 'sky' | 'amber' | 'emerald' | 'slate'

interface StatCardProps {
  label: string
  value: string | number
  hint?: string
  icon?: LucideIcon
  tone?: 'default' | 'success' | 'warning' | 'destructive' | 'info'
  /**
   * Cor de destaque discreta: fio no topo e ícone tingido. Quando presente,
   * substitui o `tone`.
   */
  accent?: StatAccent
  /** Torna o cartão um link para a página onde o número aparece. */
  href?: string
}

const TONE_CLASS: Record<NonNullable<StatCardProps['tone']>, string> = {
  default:     'bg-primary/10 text-primary',
  success:     'bg-success/10 text-success',
  warning:     'bg-warning/10 text-warning',
  destructive: 'bg-destructive/10 text-destructive',
  info:        'bg-info/10 text-info',
}

// Classes completas (o Tailwind só gera o que aparece literal no código).
const ACCENT_CLASS: Record<StatAccent, { bar: string; icon: string; hover: string }> = {
  sky: {
    bar:   'bg-sky-300/70 dark:bg-sky-700/60',
    icon:  'bg-sky-50 text-sky-600 dark:bg-sky-950/50 dark:text-sky-400',
    hover: 'group-hover:border-sky-300 dark:group-hover:border-sky-800',
  },
  amber: {
    bar:   'bg-amber-300/70 dark:bg-amber-700/60',
    icon:  'bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400',
    hover: 'group-hover:border-amber-300 dark:group-hover:border-amber-800',
  },
  emerald: {
    bar:   'bg-emerald-300/70 dark:bg-emerald-700/60',
    icon:  'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400',
    hover: 'group-hover:border-emerald-300 dark:group-hover:border-emerald-800',
  },
  slate: {
    bar:   'bg-slate-200 dark:bg-slate-700/60',
    icon:  'bg-slate-100 text-slate-500 dark:bg-slate-800/60 dark:text-slate-400',
    hover: 'group-hover:border-slate-300 dark:group-hover:border-slate-700',
  },
}

export function StatCard({ label, value, hint, icon: Icon, tone = 'default', accent, href }: StatCardProps) {
  const a = accent ? ACCENT_CLASS[accent] : null

  const card = (
    <Card
      className={cn(
        'relative h-full overflow-hidden p-5 shadow-elev-sm transition-all ease-quint hover:shadow-elev-md',
        href && (a ? a.hover : 'group-hover:border-primary/40'),
      )}
    >
      {a && <span aria-hidden className={cn('absolute inset-x-0 top-0 h-0.5', a.bar)} />}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1.5">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
          <p className="text-3xl font-semibold tabular-nums tracking-tight text-foreground">{value}</p>
          {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
        </div>
        {Icon && (
          <div
            className={cn(
              'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
              a ? a.icon : TONE_CLASS[tone],
            )}
          >
            <Icon className="h-4 w-4" />
          </div>
        )}
      </div>
      {href && (
        <ArrowUpRight
          aria-hidden
          className="absolute bottom-3 right-3 h-4 w-4 text-muted-foreground/40 transition-all ease-quint group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-foreground/70"
        />
      )}
    </Card>
  )

  if (!href) return card

  return (
    <Link
      href={href}
      aria-label={`${label}: ${value}${hint ? ` ${hint}` : ''}`}
      className="group block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      {card}
    </Link>
  )
}
