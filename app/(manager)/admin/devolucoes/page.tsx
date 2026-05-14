import { getAdminReturnsAction } from './actions'
import { ReturnsAdminTable } from './components/returns-admin-table'
import type { ReturnStatus } from '@/types'

interface SearchParams {
  rv?:     string
  status?: string
  page?:   string
}

const VALID_STATUSES: ReturnStatus[] = ['awaiting_decision', 'decided', 'processed']

export default async function AdminReturnsPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const rv     = searchParams.rv ?? ''
  const status = VALID_STATUSES.includes(searchParams.status as ReturnStatus)
    ? (searchParams.status as ReturnStatus)
    : undefined
  const page   = Math.max(1, parseInt(searchParams.page ?? '1', 10) || 1)

  const result = await getAdminReturnsAction({
    rv:     rv || undefined,
    status: status,
    page,
  })

  if ('error' in result) {
    return (
      <div className="rounded-lg border bg-card p-6 text-center text-destructive text-sm">
        Erro ao carregar devoluções: {result.error}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <ReturnsAdminTable
        rows={result.rows}
        total={result.total}
        currentRv={rv}
        currentStatus={searchParams.status ?? ''}
        currentPage={page}
      />
    </div>
  )
}
