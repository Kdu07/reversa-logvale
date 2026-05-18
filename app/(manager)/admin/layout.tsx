import RoleLayout from '@/components/shared/role-layout'
import ManagerNav from './components/manager-nav'

export default function ManagerLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoleLayout role="manager" nav={<ManagerNav />}>
      {children}
    </RoleLayout>
  )
}
