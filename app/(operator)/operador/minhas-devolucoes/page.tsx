import { getMyReturnsAction, getMyReturnDepositorsAction } from './actions'
import { MyReturnsList } from './components/my-returns-list'
import { PageHeader } from '@/components/shared/page-header'
import { isItemConditionFilter } from '@/lib/operator-home'

interface SearchParams {
  scope?:     string
  rv?:        string
  depositor?: string
  from?:      string
  to?:        string
  condition?: string
  nokey?:     string
  page?:      string
}

export default async function MyReturnsPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const scope     = searchParams.scope === 'pending' ? 'pending' : 'mine'
  const rv        = searchParams.rv        ?? ''
  const depositor = searchParams.depositor ?? ''
  const from      = searchParams.from      ?? ''
  const to        = searchParams.to        ?? ''
  const condition  = isItemConditionFilter(searchParams.condition) ? searchParams.condition : undefined
  const withoutKey = searchParams.nokey === '1'
  const page      = Math.max(1, parseInt(searchParams.page ?? '1', 10) || 1)

  const [result, depositors] = await Promise.all([
    getMyReturnsAction({
      scope,
      rv:         rv        || undefined,
      depositorId: depositor || undefined,
      from:        from      || undefined,
      to:          to        || undefined,
      condition,
      withoutKey,
      page,
    }),
    getMyReturnDepositorsAction(scope),
  ])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Minhas Devoluções"
        description={scope === 'pending'
          ? 'Todas as devoluções aguardando decisão do cliente, de qualquer operador — podem ser editadas.'
          : 'Todas as devoluções que você recebeu.'}
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
          currentScope={scope}
          currentRv={rv}
          currentDepositor={depositor}
          currentFrom={from}
          currentTo={to}
          currentCondition={condition ?? ''}
          currentWithoutKey={withoutKey}
          currentPage={page}
        />
      )}
    </div>
  )
}
