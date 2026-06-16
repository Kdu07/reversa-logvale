'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Fragment } from 'react'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { ThemeToggle } from './theme-toggle'
import { cn } from '@/lib/utils'

const VIEW_AREAS = [
  { label: 'Admin',    href: '/admin'    },
  { label: 'Operador', href: '/operador' },
  { label: 'Cliente',  href: '/cliente'  },
]

const LABELS: Record<string, string> = {
  cliente:      'Cliente',
  operador:     'Operador',
  admin:        'Administrador',
  historico:    'Histórico',
  perfil:       'Perfil',
  recebimento:  'Recebimento',
  tratativas:   'Tratativas',
  devolucoes:   'Devoluções',
  depositantes: 'Depositantes',
  usuarios:     'Usuários',
}

function humanize(seg: string) {
  return LABELS[seg] ?? seg.charAt(0).toUpperCase() + seg.slice(1)
}

export function Topbar({ isSuper = false }: { isSuper?: boolean }) {
  const pathname = usePathname()
  const segments = pathname.split('/').filter(Boolean)

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-border bg-background/80 px-3 backdrop-blur-md sm:px-5">
      <div className="flex min-w-0 items-center gap-2">
        <SidebarTrigger className="-ml-1 h-8 w-8" />
        <nav aria-label="Navegação" className="flex min-w-0 items-center gap-1.5 truncate text-sm">
          {segments.length === 0 ? (
            <span className="text-muted-foreground">Início</span>
          ) : (
            segments.map((seg, i) => {
              const last = i === segments.length - 1
              return (
                <Fragment key={seg + i}>
                  {i > 0 && <span className="text-muted-foreground/50">/</span>}
                  <span className={last ? 'font-medium text-foreground' : 'text-muted-foreground'}>
                    {humanize(seg)}
                  </span>
                </Fragment>
              )
            })
          )}
        </nav>
      </div>
      <div className="flex items-center gap-2">
        {isSuper && (
          <div
            role="navigation"
            aria-label="Alternar visão"
            className="flex items-center gap-0.5 rounded-lg border border-border bg-muted/50 p-0.5"
          >
            {VIEW_AREAS.map((area) => {
              const active = pathname === area.href || pathname.startsWith(area.href + '/')
              return (
                <Link
                  key={area.href}
                  href={area.href}
                  className={cn(
                    'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                    active
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {area.label}
                </Link>
              )
            })}
          </div>
        )}
        <ThemeToggle />
      </div>
    </header>
  )
}
