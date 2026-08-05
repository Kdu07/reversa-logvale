import { getReportDepositorsAction } from './actions'
import { ReportForm } from './components/report-form'
import { PageHeader } from '@/components/shared/page-header'
import { previousMonthValue, todayValue } from '@/lib/reports/period'

export default async function ReportsPage() {
  const result = await getReportDepositorsAction()

  if ('error' in result) {
    return (
      <div className="space-y-6">
        <PageHeader title="Relatórios" description="Exportação de devoluções por período e depositante." />
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-6 text-center text-destructive text-sm">
          Erro ao carregar depositantes: {result.error}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Relatórios" description="Exportação de devoluções por período e depositante." />
      <ReportForm
        depositors={result.rows}
        defaultMonth={previousMonthValue()}
        today={todayValue()}
      />
    </div>
  )
}
