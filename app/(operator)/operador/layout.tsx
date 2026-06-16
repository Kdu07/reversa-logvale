import { getCurrentUser } from '@/lib/supabase/get-current-user'
import { isSuperUser } from '@/lib/auth/super'
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar'
import { AppSidebar } from '@/components/shared/app-sidebar'
import { Topbar } from '@/components/shared/topbar'

export default async function OperatorLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser()
  return (
    <SidebarProvider>
      <AppSidebar role="operator" fullName={user.profile.full_name} email={user.email} />
      <SidebarInset>
        <Topbar isSuper={isSuperUser(user)} />
        <main className="flex-1 px-4 py-6 sm:px-6 sm:py-8">
          <div className="mx-auto w-full max-w-5xl">{children}</div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
