import { cn } from '@/lib/utils'
import { DECISION_SHORT, DECISION_TONE } from '@/lib/decisions'
import type { ReturnDecision } from '@/types'

const TONE_CLASS: Record<'success' | 'warning' | 'destructive' | 'info', string> = {
  success:     'border-green-300 bg-green-100 text-green-800',
  warning:     'border-amber-300 bg-amber-100 text-amber-800',
  destructive: 'border-red-300   bg-red-100   text-red-800',
  info:        'border-blue-300  bg-blue-100  text-blue-800',
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
