import { isValidElement } from 'react'
import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'

interface EmptyStateProps {
  icon?: LucideIcon | ReactNode
  title: string
  description?: string
  action?: ReactNode
  className?: string
}

function isLucideIcon(v: unknown): v is LucideIcon {
  return !!v && !isValidElement(v)
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  const IconEl = isLucideIcon(icon) ? icon : null
  const iconNode = !isLucideIcon(icon) ? icon : null

  return (
    <div className={cn('flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed bg-card/50 px-6 py-16 text-center', className)}>
      {(IconEl || iconNode) && (
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
          {IconEl ? <IconEl className="h-5 w-5" /> : iconNode}
        </div>
      )}
      <div className="space-y-1">
        <p className="text-base font-medium text-foreground">{title}</p>
        {description && <p className="mx-auto max-w-sm text-sm text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  )
}
