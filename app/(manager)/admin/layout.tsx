import RoleLayout from '@/components/shared/role-layout'

export default function ManagerLayout({ children }: { children: React.ReactNode }) {
  return <RoleLayout role="manager">{children}</RoleLayout>
}
