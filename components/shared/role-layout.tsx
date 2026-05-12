import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/supabase/get-current-user'
import Header from '@/components/shared/header'
import type { UserRole } from '@/types'

interface RoleLayoutProps {
  role: UserRole
  maxWidth?: string
  children: React.ReactNode
}

export default async function RoleLayout({ role, maxWidth = 'max-w-7xl', children }: RoleLayoutProps) {
  const user = await getCurrentUser()
  if (user.profile.role !== role) redirect('/login')
  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Header user={user} />
      <main className={`flex-1 container mx-auto px-4 py-6 ${maxWidth}`}>{children}</main>
    </div>
  )
}
