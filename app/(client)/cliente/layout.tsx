import { getCurrentUser } from '@/lib/supabase/get-current-user'
import { isSuperUser } from '@/lib/auth/super'
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar'
import { AppSidebar } from '@/components/shared/app-sidebar'
import { Topbar } from '@/components/shared/topbar'
import { countPendingInvoicesAction } from './notas-pendentes/actions'

export default async function ClientLayout({ children }: { children: React.ReactNode }) {
  const [user, pendingInvoices] = await Promise.all([
    getCurrentUser(),
    countPendingInvoicesAction(),
  ])
  return (
    <SidebarProvider>
      <AppSidebar
        role="client"
        fullName={user.profile.full_name}
        email={user.email}
        badges={{ '/cliente/notas-pendentes': pendingInvoices }}
      />
      <SidebarInset>
        <Topbar isSuper={isSuperUser(user)} />
        <main className="flex-1 px-4 py-6 sm:px-6 sm:py-8">
          <div className="mx-auto w-full max-w-7xl">{children}</div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
