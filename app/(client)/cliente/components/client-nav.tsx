'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ptBR } from '@/lib/i18n/pt-BR'

const links = [
  { href: '/cliente',           label: ptBR.nav.client.home    },
  { href: '/cliente/historico', label: ptBR.nav.client.history },
]

export default function ClientNav() {
  const pathname = usePathname()

  return (
    <nav className="bg-white border-b border-border">
      <div className="container mx-auto px-4 max-w-7xl">
        <ul className="flex gap-1">
          {links.map(({ href, label }) => {
            const active = pathname === href
            return (
              <li key={href}>
                <Link
                  href={href}
                  className={`block px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                    active
                      ? 'border-primary text-primary'
                      : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
                  }`}
                >
                  {label}
                </Link>
              </li>
            )
          })}
        </ul>
      </div>
    </nav>
  )
}
