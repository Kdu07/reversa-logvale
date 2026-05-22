'use client'

import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

interface CountdownTimerProps {
  deadlineAt?: string
  receivedAt?: string
  className?: string
}

function computeDeadline(receivedAt?: string, deadlineAt?: string): number {
  if (deadlineAt) return new Date(deadlineAt).getTime()
  if (receivedAt) return new Date(receivedAt).getTime() + 72 * 3_600_000
  return Date.now()
}

function diffParts(target: number) {
  const ms = target - Date.now()
  const sign = ms < 0 ? -1 : 1
  const abs = Math.abs(ms)
  const h = Math.floor(abs / 3_600_000)
  const m = Math.floor((abs % 3_600_000) / 60_000)
  const s = Math.floor((abs % 60_000) / 1000)
  return { sign, h, m, s, totalMs: ms }
}

export function CountdownTimer({ deadlineAt, receivedAt, className }: CountdownTimerProps) {
  const [, tick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 1000)
    return () => clearInterval(id)
  }, [])

  const deadline = computeDeadline(receivedAt, deadlineAt)
  const { sign, h, m, s, totalMs } = diffParts(deadline)

  const overdue = sign < 0
  const critical = !overdue && totalMs < 6 * 3_600_000

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 font-mono text-xs tabular-nums',
        overdue   && 'border-destructive/30 bg-destructive/10 text-destructive',
        critical  && 'border-warning/30 bg-warning/10 text-warning',
        !overdue && !critical && 'border-border bg-muted/60 text-foreground',
        className,
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', overdue ? 'bg-destructive' : critical ? 'bg-warning' : 'bg-success')} />
      {overdue ? 'atrasado ' : ''}
      {String(h).padStart(2, '0')}:{String(m).padStart(2, '0')}:{String(s).padStart(2, '0')}
    </span>
  )
}
