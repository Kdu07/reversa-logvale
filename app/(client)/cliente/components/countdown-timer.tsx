'use client'

import { useEffect, useState } from 'react'

interface CountdownTimerProps {
  receivedAt: string
}

function computeRemaining(receivedAt: string): number {
  const deadline = new Date(receivedAt).getTime() + 72 * 60 * 60 * 1000
  return deadline - Date.now()
}

function formatRemaining(ms: number): { text: string; className: string } {
  if (ms <= 0) {
    return { text: 'Expirado', className: 'text-destructive font-medium' }
  }

  const totalMinutes = Math.floor(ms / 60000)
  const hours        = Math.floor(totalMinutes / 60)
  const minutes      = totalMinutes % 60
  const days         = Math.floor(hours / 24)
  const remHours     = hours % 24

  if (ms <= 24 * 60 * 60 * 1000) {
    return {
      text:      `${hours}h ${minutes}m`,
      className: 'text-destructive font-medium animate-pulse',
    }
  }
  if (ms <= 48 * 60 * 60 * 1000) {
    return {
      text:      `${hours}h`,
      className: 'text-amber-600 font-medium',
    }
  }
  return {
    text:      `${days}d ${remHours}h`,
    className: 'text-foreground',
  }
}

export function CountdownTimer({ receivedAt }: CountdownTimerProps) {
  const [remaining, setRemaining] = useState(() => computeRemaining(receivedAt))

  useEffect(() => {
    const id = setInterval(() => setRemaining(computeRemaining(receivedAt)), 60_000)
    return () => clearInterval(id)
  }, [receivedAt])

  const { text, className } = formatRemaining(remaining)
  return <span className={`text-sm tabular-nums ${className}`}>{text}</span>
}
