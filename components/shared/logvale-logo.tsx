import Image from 'next/image'
import { cn } from '@/lib/utils'
import { ReversaIcon } from './reversa-icon'

type Variant = 'full' | 'mark'
type Size = 'sm' | 'md' | 'lg' | 'xl'

const SIZE_MAP: Record<Size, { height: number }> = {
  sm: { height: 24 },
  md: { height: 32 },
  lg: { height: 40 },
  xl: { height: 56 },
}

interface LogvaleLogoProps {
  variant?: Variant
  size?: Size
  withTagline?: boolean
  className?: string
  subtitle?: string
}

export default function LogvaleLogo({
  variant = 'full',
  size = 'md',
  withTagline = false,
  className,
  subtitle,
}: LogvaleLogoProps) {
  const { height } = SIZE_MAP[size]

  if (variant === 'mark') {
    return (
      <ReversaIcon size={height} className={className} aria-label="Logvale" />
    )
  }

  return (
    <div className={cn('inline-flex flex-col gap-1', className)}>
      <div className="inline-flex items-center gap-3.5">
        <ReversaIcon size={height} />
        <Image
          src="/logvale-logo.png"
          alt="Logvale"
          width={height * 4}
          height={height}
          className="w-auto select-none object-contain"
          style={{ height }}
          draggable={false}
          priority
        />
      </div>
      {(withTagline || subtitle) && (
        <span className="text-xs font-medium tracking-wide text-muted-foreground">
          {subtitle ?? 'Gestão de Devoluções'}
        </span>
      )}
    </div>
  )
}
