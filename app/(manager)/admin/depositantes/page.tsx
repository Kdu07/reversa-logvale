import { getDepositorsAction } from './actions'
import { DepositorsTable } from './components/depositors-table'
import { PageHeader } from '@/components/shared/page-header'

interface SearchParams {
  page?:   string
  search?: string
}

export default async function DepositorsPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const page   = Math.max(1, parseInt(searchParams.page ?? '1', 10) || 1)
  const search = searchParams.search ?? ''

  const result = await getDepositorsAction({ page, search: search || undefined })

  if ('error' in result) {
    return (
      <div className="space-y-6">
        <PageHeader title="Depositantes" description="Empresas vinculadas ao sistema." />
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-6 text-center text-destructive text-sm">
          Erro ao carregar depositantes: {result.error}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Depositantes" description="Empresas vinculadas ao sistema." />
      <DepositorsTable rows={result.rows} />
    </div>
  )
}
