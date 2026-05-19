'use client'

import { useRouter, useSearchParams } from 'next/navigation'

const PERIODS = [
  { key: 'today', label: 'Hoje' },
  { key: '7d',    label: '7 dias' },
  { key: '30d',   label: '30 dias' },
] as const

interface PeriodFilterProps {
  currentPeriod: string
}

export function PeriodFilter({ currentPeriod }: PeriodFilterProps) {
  const router     = useRouter()
  const params     = useSearchParams()

  function select(period: string) {
    const next = new URLSearchParams(params.toString())
    next.set('period', period)
    router.push(`?${next.toString()}`)
  }

  return (
    <div className="flex gap-2">
      {PERIODS.map(({ key, label }) => (
        <button
          key={key}
          type="button"
          onClick={() => select(key)}
          className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
            currentPeriod === key
              ? 'bg-primary text-primary-foreground border-primary'
              : 'bg-transparent text-muted-foreground border-border hover:border-primary hover:text-primary'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
