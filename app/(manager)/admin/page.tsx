import Link from 'next/link'
import dynamic from 'next/dynamic'
import { getDashboardStatsAction } from './actions'
import { PageHeader } from '@/components/shared/page-header'
import { StatCard } from '@/components/shared/stat-card'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ptBR } from '@/lib/i18n/pt-BR'
import { Package, Clock, Zap, AlertTriangle } from 'lucide-react'

const StatsCharts = dynamic(
  () => import('./components/stats-charts').then((m) => m.StatsCharts),
  { ssr: false, loading: () => <div className="h-64 animate-pulse bg-muted rounded-lg" /> }
)

function formatHours(h: number | null) {
  if (h === null) return '—'
  return `${h}h`
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export default async function ManagerDashboardPage() {
  const t = ptBR.admin.dashboard
  const stats = await getDashboardStatsAction()

  if ('error' in stats) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-6 text-center text-destructive text-sm">
        Erro ao carregar dashboard: {stats.error}
      </div>
    )
  }

  const pending = stats.byStatus.find((s) => s.status === 'awaiting_decision')?.count ?? 0

  return (
    <div className="space-y-8">
      <PageHeader title={t.title} description="Visão geral das devoluções e atividades." />

      {/* Metric cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label={t.cardTotal}
          value={stats.totals.last30d}
          hint="últimos 30 dias"
          icon={Package}
          tone="default"
        />
        <StatCard
          label={t.cardPending}
          value={pending}
          icon={AlertTriangle}
          tone={pending > 0 ? 'warning' : 'default'}
        />
        <StatCard
          label={t.cardAvgDecision}
          value={formatHours(stats.avgDecisionHours)}
          icon={Clock}
          tone="info"
        />
        <StatCard
          label={t.cardAutoRate}
          value={stats.autoRate !== null ? `${stats.autoRate}%` : '—'}
          icon={Zap}
          tone="default"
        />
      </div>

      {/* Charts */}
      <StatsCharts byStatus={stats.byStatus} byDecision={stats.byDecision} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top clients */}
        {stats.topClients.length > 0 && (
          <Card className="shadow-elev-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">{t.topClients}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {stats.topClients.map((c) => (
                <div key={c.name} className="flex items-center justify-between text-sm">
                  <span className="text-foreground truncate max-w-xs">{c.name}</span>
                  <span className="font-semibold text-primary ml-4 shrink-0 tabular-nums">{c.count}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Urgent pending */}
        <Card className="shadow-elev-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">{t.urgentTitle}</CardTitle>
          </CardHeader>
          <CardContent>
            {stats.urgentPending.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t.urgentEmpty}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left border-b">
                      <th className="pb-2 text-xs font-medium text-muted-foreground">RV</th>
                      <th className="pb-2 text-xs font-medium text-muted-foreground">Depositante</th>
                      <th className="pb-2 text-xs font-medium text-muted-foreground">Recebido em</th>
                      <th className="pb-2" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {stats.urgentPending.map((r) => (
                      <tr key={r.id}>
                        <td className="py-2 font-mono font-medium text-foreground">{r.rv}</td>
                        <td className="py-2 text-muted-foreground">{r.depositorName ?? '—'}</td>
                        <td className="py-2 text-muted-foreground text-xs">{formatDate(r.receivedAt)}</td>
                        <td className="py-2">
                          <Link
                            href={`/admin/devolucoes?rv=${encodeURIComponent(r.rv)}`}
                            className="text-xs font-medium text-primary hover:underline"
                          >
                            Ver
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
