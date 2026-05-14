import { getUsersAction, getDepositorsListAction } from './actions'
import { UsersTable } from './components/users-table'

export default async function UsersPage() {
  const [usersResult, depositorsResult] = await Promise.all([
    getUsersAction(),
    getDepositorsListAction(),
  ])

  if ('error' in usersResult) {
    return (
      <div className="rounded-lg border bg-card p-6 text-center text-destructive text-sm">
        Erro ao carregar usuários: {usersResult.error}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <UsersTable
        users={usersResult}
        depositors={'error' in depositorsResult ? [] : depositorsResult}
      />
    </div>
  )
}
