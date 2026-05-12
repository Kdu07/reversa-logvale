import RoleLayout from '@/components/shared/role-layout'

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return <RoleLayout role="client">{children}</RoleLayout>
}
