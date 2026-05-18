import RoleLayout from '@/components/shared/role-layout'
import ClientNav from './components/client-nav'

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoleLayout role="client" nav={<ClientNav />}>
      {children}
    </RoleLayout>
  )
}
