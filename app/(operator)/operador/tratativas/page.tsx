import { getCurrentUser } from '@/lib/supabase/get-current-user'
import { getTrativasAction, getTrativaDepositorsAction } from './actions'
import { TrativasList } from './components/tratativas-list'
import { PageHeader } from '@/components/shared/page-header'
import { isReturnDecision } from '@/lib/decisions'
import { parseDepositorParam } from '@/lib/operator-home'

interface SearchParams {
  rv?:        string
  decision?:  string
  depositor?: string
  /** Id da devolução cujo modal de detalhes abre ao carregar (links da visão geral). */
  open?:      string
  page?:      string
}

export default async function TratativasPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  await getCurrentUser()

  const rv          = searchParams.rv ?? ''
  const decision    = isReturnDecision(searchParams.decision) ? searchParams.decision : undefined
  const depositorId = parseDepositorParam(searchParams.depositor)
  const openId      = searchParams.open ?? ''
  const page        = Math.max(1, parseInt(searchParams.page ?? '1', 10) || 1)

  const [result, depositors] = await Promise.all([
    getTrativasAction({ rv: rv || undefined, decision, depositorId, page }),
    getTrativaDepositorsAction(),
  ])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tratativas"
        description="Devoluções com decisão do cliente pendentes de execução."
      />
      {'error' in result ? (
        <div className="rounded-lg border bg-destructive/10 border-destructive/30 p-6 text-center text-destructive text-sm">
          Erro ao carregar tratativas: {result.error}
        </div>
      ) : (
        <TrativasList
          rows={result.rows}
          total={result.total}
          currentRv={rv}
          currentDecision={decision ?? ''}
          depositors={depositors}
          currentDepositor={depositorId ?? ''}
          currentPage={page}
          openId={openId}
        />
      )}
    </div>
  )
}
