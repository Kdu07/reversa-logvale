import { getClientHistoryAction } from '../actions'
import { ReturnsTable } from '../components/returns-table'
import Link from 'next/link'

interface SearchParams {
  page?:        string
  depositorId?: string
  from?:        string
  to?:          string
}

export default async function ClientHistoricoPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const page        = Math.max(1, parseInt(searchParams.page ?? '1', 10) || 1)
  const depositorId = searchParams.depositorId ?? ''
  const from        = searchParams.from ?? ''
  const to          = searchParams.to ?? ''

  const result = await getClientHistoryAction({ page, depositorId: depositorId || undefined, from: from || undefined, to: to || undefined })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold text-primary">Histórico de Decisões</h1>
        <Link
          href="/cliente"
          className="text-sm text-primary hover:underline"
        >
          ← Pendentes
        </Link>
      </div>

      {'error' in result ? (
        <div className="rounded-lg border bg-card p-6 text-center text-destructive text-sm">
          Erro ao carregar histórico: {result.error}
        </div>
      ) : (
        <ReturnsTable
          rows={result.rows}
          total={result.total}
          depositors={result.depositors}
          currentPage={page}
          currentDepositor={depositorId}
          currentFrom={from}
          currentTo={to}
          mode="history"
        />
      )}
    </div>
  )
}
