import RoleLayout from '@/components/shared/role-layout'
import OperatorNav from './components/operator-nav'

export default function OperatorLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoleLayout role="operator" maxWidth="max-w-5xl" nav={<OperatorNav />}>
      {children}
    </RoleLayout>
  )
}
