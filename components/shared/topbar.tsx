'use client'

import { usePathname } from 'next/navigation'
import { Fragment } from 'react'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { ThemeToggle } from './theme-toggle'

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

export function Topbar() {
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
      <ThemeToggle />
    </header>
  )
}
