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

function formatRemaining(target: number): { text: string; overdue: boolean; critical: boolean } {
  const ms = target - Date.now()
  if (ms <= 0) return { text: 'Expirado', overdue: true, critical: false }

  const critical = ms < 6 * 3_600_000
  if (ms < 3_600_000) {
    return { text: `${Math.ceil(ms / 60_000)} min restantes`, overdue: false, critical }
  }
  return { text: `${Math.floor(ms / 3_600_000)}h restantes`, overdue: false, critical }
}

export function CountdownTimer({ deadlineAt, receivedAt, className }: CountdownTimerProps) {
  const [, tick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 60_000)
    return () => clearInterval(id)
  }, [])

  const deadline = computeDeadline(receivedAt, deadlineAt)
  const { text, overdue, critical } = formatRemaining(deadline)

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs',
        overdue   && 'border-destructive/30 bg-destructive/10 text-destructive',
        critical  && 'border-warning/30 bg-warning/10 text-warning',
        !overdue && !critical && 'border-border bg-muted/60 text-foreground',
        className,
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', overdue ? 'bg-destructive' : critical ? 'bg-warning' : 'bg-success')} />
      {text}
    </span>
  )
}
