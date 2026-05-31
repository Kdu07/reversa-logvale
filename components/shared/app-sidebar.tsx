'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, PackageCheck, History, UserRound,
  ClipboardList, Boxes, Users, Building2, Inbox,
} from 'lucide-react'
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar'
import LogvaleLogo from './logvale-logo'
import { ReversaIcon } from './reversa-icon'
import SignOutButton from './sign-out-button'
import { cn } from '@/lib/utils'
import type { UserRole } from '@/types'

type NavItem = { title: string; url: string; icon: React.ElementType }

const NAV: Record<UserRole, { label: string; items: NavItem[] }[]> = {
  client: [
    {
      label: 'Devoluções',
      items: [
        { title: 'Pendentes', url: '/cliente',          icon: Inbox   },
        { title: 'Histórico', url: '/cliente/historico', icon: History },
      ],
    },
    {
      label: 'Conta',
      items: [
        { title: 'Perfil', url: '/cliente/perfil', icon: UserRound },
      ],
    },
  ],
  operator: [
    {
      label: 'Operação',
      items: [
        { title: 'Visão geral',  url: '/operador',              icon: LayoutDashboard },
        { title: 'Recebimento', url: '/operador/recebimento',  icon: PackageCheck    },
        { title: 'Tratativas',  url: '/operador/tratativas',   icon: ClipboardList   },
      ],
    },
  ],
  manager: [
    {
      label: 'Gestão',
      items: [
        { title: 'Visão geral',  url: '/admin',               icon: LayoutDashboard },
        { title: 'Devoluções',   url: '/admin/devolucoes',    icon: Boxes           },
        { title: 'Depositantes', url: '/admin/depositantes',  icon: Building2       },
        { title: 'Usuários',     url: '/admin/usuarios',      icon: Users           },
      ],
    },
  ],
}

interface AppSidebarProps {
  role: UserRole
  fullName: string
  email: string
}

export function AppSidebar({ role, fullName, email }: AppSidebarProps) {
  const { state } = useSidebar()
  const collapsed = state === 'collapsed'
  const pathname = usePathname()
  const sections = NAV[role] ?? []

  const isActive = (url: string) => {
    const exactRoots = ['/cliente', '/operador', '/admin']
    return exactRoots.includes(url) ? pathname === url : pathname.startsWith(url)
  }

  const initials = fullName
    .split(' ')
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <Sidebar collapsible="icon" className="border-r">
      <SidebarHeader className="border-b border-sidebar-border">
        <Link
          href="/"
          className={cn('flex items-center gap-2.5 px-1.5 py-1.5 rounded-md hover:bg-sidebar-accent transition-colors', collapsed && 'justify-center px-0')}
        >
          {collapsed
            ? (
              <div className="h-8 w-8 rounded-lg bg-gradient-primary flex items-center justify-center">
                <ReversaIcon size={18} className="[&_path]:stroke-white" />
              </div>
            )
            : <LogvaleLogo variant="full" size="sm" className="ml-1" />
          }
        </Link>
      </SidebarHeader>

      <SidebarContent>
        {sections.map((section) => (
          <SidebarGroup key={section.label}>
            <SidebarGroupLabel>{section.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {section.items.map((item) => {
                  const active = isActive(item.url)
                  return (
                    <SidebarMenuItem key={item.url}>
                      <SidebarMenuButton
                        asChild
                        isActive={active}
                        tooltip={item.title}
                        className="h-9 transition-colors ease-quint"
                      >
                        <Link href={item.url} className="flex items-center gap-2.5">
                          <item.icon className="h-4 w-4 shrink-0" />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border gap-1">
        <div className={cn('flex items-center gap-2.5 px-2 py-1.5', collapsed && 'justify-center px-0')}>
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-primary text-xs font-semibold text-primary-foreground">
            {initials}
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-sidebar-foreground">{fullName}</p>
              <p className="truncate text-xs text-muted-foreground">{email}</p>
            </div>
          )}
        </div>
        {!collapsed && <SignOutButton />}
      </SidebarFooter>
    </Sidebar>
  )
}
