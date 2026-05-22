import { getUsersAction, getDepositorsListAction } from './actions'
import { UsersTable } from './components/users-table'
import { PageHeader } from '@/components/shared/page-header'

export default async function UsersPage() {
  const [usersResult, depositorsResult] = await Promise.all([
    getUsersAction(),
    getDepositorsListAction(),
  ])

  if ('error' in usersResult) {
    return (
      <div className="space-y-6">
        <PageHeader title="Usuários" description="Gerencie operadores, clientes e administradores." />
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-6 text-center text-destructive text-sm">
          Erro ao carregar usuários: {usersResult.error}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Usuários" description="Gerencie operadores, clientes e administradores." />
      <UsersTable
        users={usersResult}
        depositors={'error' in depositorsResult ? [] : depositorsResult}
      />
    </div>
  )
}
