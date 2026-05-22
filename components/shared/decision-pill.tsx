import { cn } from '@/lib/utils'
import { DECISION_SHORT, DECISION_TONE } from '@/lib/decisions'
import type { ReturnDecision } from '@/types'

const TONE_CLASS: Record<'success' | 'warning' | 'destructive' | 'info', string> = {
  success:     'border-success/30 bg-success/10 text-success',
  warning:     'border-warning/40 bg-warning/10 text-warning-foreground dark:text-warning',
  destructive: 'border-destructive/30 bg-destructive/10 text-destructive',
  info:        'border-info/30 bg-info/10 text-info',
}

export function DecisionPill({ decision, className }: { decision: ReturnDecision; className?: string }) {
  const tone = DECISION_TONE[decision]
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium', TONE_CLASS[tone], className)}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {DECISION_SHORT[decision]}
    </span>
  )
}
