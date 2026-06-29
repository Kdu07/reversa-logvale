import { getMyReturnsAction, getMyReturnDepositorsAction } from './actions'
import { MyReturnsList } from './components/my-returns-list'
import { PageHeader } from '@/components/shared/page-header'

interface SearchParams {
  rv?:        string
  depositor?: string
  from?:      string
  to?:        string
  page?:      string
}

export default async function MyReturnsPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const rv        = searchParams.rv        ?? ''
  const depositor = searchParams.depositor ?? ''
  const from      = searchParams.from      ?? ''
  const to        = searchParams.to        ?? ''
  const page      = Math.max(1, parseInt(searchParams.page ?? '1', 10) || 1)

  const [result, depositors] = await Promise.all([
    getMyReturnsAction({
      rv:          rv        || undefined,
      depositorId: depositor || undefined,
      from:        from      || undefined,
      to:          to        || undefined,
      page,
    }),
    getMyReturnDepositorsAction(),
  ])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Minhas Devoluções"
        description="Todas as devoluções que você recebeu."
      />
      {'error' in result ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-6 text-center text-destructive text-sm">
          Erro ao carregar devoluções: {result.error}
        </div>
      ) : (
        <MyReturnsList
          rows={result.rows}
          total={result.total}
          depositors={depositors}
          currentRv={rv}
          currentDepositor={depositor}
          currentFrom={from}
          currentTo={to}
          currentPage={page}
        />
      )}
    </div>
  )
}
