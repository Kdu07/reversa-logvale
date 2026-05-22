import Link from 'next/link'
import { getClientReturnsAction } from './actions'
import { ReturnsTable } from './components/returns-table'
import { PageHeader } from '@/components/shared/page-header'
import { Button } from '@/components/ui/button'
import { History } from 'lucide-react'

interface SearchParams {
  page?:        string
  depositorId?: string
  from?:        string
  to?:          string
}

export default async function ClientHomePage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const page        = Math.max(1, parseInt(searchParams.page ?? '1', 10) || 1)
  const depositorId = searchParams.depositorId ?? ''
  const from        = searchParams.from ?? ''
  const to          = searchParams.to ?? ''

  const result = await getClientReturnsAction({ page, depositorId: depositorId || undefined, from: from || undefined, to: to || undefined })

  return (
    <div className="space-y-6">
      <PageHeader
        title="Devoluções Pendentes"
        description="Revise as devoluções e registre sua decisão."
        actions={
          <Button asChild variant="outline" size="sm" className="gap-2">
            <Link href="/cliente/historico">
              <History className="h-4 w-4" />
              Ver histórico
            </Link>
          </Button>
        }
      />

      {'error' in result ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-6 text-center text-destructive text-sm">
          Erro ao carregar devoluções: {result.error}
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
          mode="pending"
        />
      )}
    </div>
  )
}
