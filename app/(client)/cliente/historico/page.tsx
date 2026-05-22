import Link from 'next/link'
import { getClientHistoryAction } from '../actions'
import { ReturnsTable } from '../components/returns-table'
import { ExportButton } from './export-button'
import { PageHeader } from '@/components/shared/page-header'
import { Button } from '@/components/ui/button'
import { Inbox } from 'lucide-react'

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
      <PageHeader
        title="Histórico de Decisões"
        description="Todas as devoluções com decisão registrada."
        actions={
          <div className="flex items-center gap-2">
            <ExportButton />
            <Button asChild variant="outline" size="sm" className="gap-2">
              <Link href="/cliente">
                <Inbox className="h-4 w-4" />
                Pendentes
              </Link>
            </Button>
          </div>
        }
      />

      {'error' in result ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-6 text-center text-destructive text-sm">
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
