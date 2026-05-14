import Link from 'next/link'
import { getDashboardStatsAction } from './actions'
import { StatsCharts } from './components/stats-charts'
import { ptBR } from '@/lib/i18n/pt-BR'

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
      <div className="rounded-lg border bg-card p-6 text-center text-destructive text-sm">
        Erro ao carregar dashboard: {stats.error}
      </div>
    )
  }

  const pending = stats.byStatus.find((s) => s.status === 'awaiting_decision')?.count ?? 0

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-primary">{t.title}</h1>

      {/* Metric cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard label={t.cardTotal} value={stats.totals.last30d} sub="últimos 30 dias" />
        <MetricCard label={t.cardPending} value={pending} highlight={pending > 0} />
        <MetricCard label={t.cardAvgDecision} value={formatHours(stats.avgDecisionHours)} />
        <MetricCard
          label={t.cardAutoRate}
          value={stats.autoRate !== null ? `${stats.autoRate}%` : '—'}
        />
      </div>

      {/* Charts */}
      <StatsCharts byStatus={stats.byStatus} byDecision={stats.byDecision} />

      {/* Top clients */}
      {stats.topClients.length > 0 && (
        <div className="rounded-lg border bg-card p-5">
          <p className="text-sm font-semibold text-foreground mb-3">{t.topClients}</p>
          <div className="space-y-2">
            {stats.topClients.map((c) => (
              <div key={c.name} className="flex items-center justify-between text-sm">
                <span className="text-foreground truncate max-w-xs">{c.name}</span>
                <span className="font-semibold text-primary ml-4 shrink-0">{c.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Urgent pending */}
      <div className="rounded-lg border bg-card p-5">
        <p className="text-sm font-semibold text-foreground mb-3">{t.urgentTitle}</p>
        {stats.urgentPending.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t.urgentEmpty}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground border-b">
                  <th className="pb-2 font-medium">RV</th>
                  <th className="pb-2 font-medium">Depositante</th>
                  <th className="pb-2 font-medium">Recebido em</th>
                  <th className="pb-2 font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {stats.urgentPending.map((r) => (
                  <tr key={r.id} className="text-foreground">
                    <td className="py-2 font-mono font-medium">{r.rv}</td>
                    <td className="py-2 text-muted-foreground">{r.depositorName ?? '—'}</td>
                    <td className="py-2 text-muted-foreground">{formatDate(r.receivedAt)}</td>
                    <td className="py-2">
                      <Link
                        href={`/admin/devolucoes?rv=${encodeURIComponent(r.rv)}`}
                        className="text-xs text-primary hover:underline"
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
      </div>
    </div>
  )
}

function MetricCard({
  label, value, sub, highlight,
}: {
  label: string
  value: string | number
  sub?: string
  highlight?: boolean
}) {
  return (
    <div className="rounded-lg border bg-card p-4 space-y-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-2xl font-bold ${highlight ? 'text-destructive' : 'text-primary'}`}>
        {value}
      </p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  )
}
