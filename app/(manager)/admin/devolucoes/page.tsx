import { getAdminReturnsAction, getMissingInvoiceXmlCountAction } from './actions'
import { ReturnsAdminTable } from './components/returns-admin-table'
import { MissingXmlPanel } from './components/missing-xml-panel'
import { PageHeader } from '@/components/shared/page-header'
import { getCurrentUser } from '@/lib/supabase/get-current-user'
import { isSuperUser } from '@/lib/auth/super'
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

  const isSuper = isSuperUser(await getCurrentUser())
  const missingXmlCount = isSuper
    ? await getMissingInvoiceXmlCountAction().then((r) => ('count' in r ? r.count : 0))
    : 0

  if ('error' in result) {
    return (
      <div className="space-y-6">
        <PageHeader title="Devoluções" description="Histórico e gestão de todas as devoluções." />
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-6 text-center text-destructive text-sm">
          Erro ao carregar devoluções: {result.error}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Devoluções" description="Histórico e gestão de todas as devoluções." />
      {isSuper && <MissingXmlPanel count={missingXmlCount} />}
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
