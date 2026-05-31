'use client'

import { useId } from 'react'
import { cn } from '@/lib/utils'

interface ReversaIconProps {
  className?: string
  size?: number
}

export function ReversaIcon({ className, size = 24 }: ReversaIconProps) {
  const id = useId()
  const gradId = `rg-${id.replace(/:/g, '')}`

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      width={size}
      height={size}
      className={cn('shrink-0', className)}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1" gradientUnits="objectBoundingBox">
          <stop stopColor="#08366D" />
          <stop offset="1" stopColor="#2462C7" />
        </linearGradient>
      </defs>
      {/* Arco semicircular: da direita (20,12) à esquerda (4,12) passando pelo topo */}
      <path
        d="M 20 12 A 8 8 0 0 0 4 12"
        stroke={`url(#${gradId})`}
        strokeWidth="3.5"
        strokeLinecap="round"
      />
      {/* Seta de retorno na ponta esquerda, apontando para baixo */}
      <path
        d="M 1 9 L 4 12 L 7 9"
        stroke="#F12D46"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
