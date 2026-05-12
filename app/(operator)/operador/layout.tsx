import RoleLayout from '@/components/shared/role-layout'

export default function OperatorLayout({ children }: { children: React.ReactNode }) {
  return <RoleLayout role="operator" maxWidth="max-w-5xl">{children}</RoleLayout>
}
