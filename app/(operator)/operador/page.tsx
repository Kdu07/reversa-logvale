import Link from 'next/link'
import { getCurrentUser } from '@/lib/supabase/get-current-user'
import { getOperatorHomeStatsAction } from './actions'
import { PageHeader } from '@/components/shared/page-header'
import { StatCard } from '@/components/shared/stat-card'
import { DecisionPill } from '@/components/shared/decision-pill'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PackageCheck, Package, ClipboardList, ArrowRight } from 'lucide-react'

function formatWaiting(decidedAt: string): string {
  const ms    = Date.now() - new Date(decidedAt).getTime()
  const hours = Math.floor(ms / (1000 * 60 * 60))
  if (hours < 24) return `${hours}h`
  return `${Math.floor(hours / 24)}d`
}

export default async function OperatorHomePage() {
  const user      = await getCurrentUser()
  const firstName = user.profile.full_name.split(' ')[0]
  const stats     = await getOperatorHomeStatsAction()

  const hasStats = !('error' in stats)

  return (
    <div className="space-y-8">
      <PageHeader
        title={`Olá, ${firstName}`}
        description="Escolha uma operação para começar."
      />

      {/* Mini-stats */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard
          label="Hoje"
          value={hasStats ? stats.todayCount : '—'}
          hint="recebimentos"
          icon={PackageCheck}
          tone="default"
        />
        <StatCard
          label="Esta semana"
          value={hasStats ? stats.weekCount : '—'}
          hint="recebimentos"
          icon={Package}
          tone="default"
        />
        <StatCard
          label="Tratativas"
          value={hasStats ? stats.pendingCount : '—'}
          hint="pendentes"
          icon={ClipboardList}
          tone={hasStats && stats.pendingCount > 0 ? 'warning' : 'default'}
        />
      </div>

      {/* Navigation cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link href="/operador/recebimento" className="group">
          <Card className="h-full shadow-elev-sm hover:shadow-elev-md transition-all ease-quint border-border/50 hover:border-primary/30">
            <CardContent className="flex items-start gap-4 p-6">
              <div className="shrink-0 rounded-xl bg-gradient-primary p-3 text-primary-foreground shadow-elev-sm">
                <PackageCheck className="h-6 w-6" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-foreground group-hover:text-primary transition-colors ease-quint">
                  Novo Recebimento
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Registrar nova devolução recebida em 7 etapas.
                </p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground/50 group-hover:text-primary group-hover:translate-x-0.5 transition-all ease-quint shrink-0 mt-0.5" />
            </CardContent>
          </Card>
        </Link>

        <Link href="/operador/tratativas" className="group">
          <Card className="h-full shadow-elev-sm hover:shadow-elev-md transition-all ease-quint border-border/50 hover:border-primary/30">
            <CardContent className="flex items-start gap-4 p-6">
              <div className="shrink-0 rounded-xl bg-gradient-primary p-3 text-primary-foreground shadow-elev-sm">
                <ClipboardList className="h-6 w-6" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-foreground group-hover:text-primary transition-colors ease-quint">
                  Tratativas
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Ver devoluções com decisão pendente de tratativa.
                </p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground/50 group-hover:text-primary group-hover:translate-x-0.5 transition-all ease-quint shrink-0 mt-0.5" />
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Tratativas urgentes */}
      {hasStats && (
        <Card className="shadow-elev-sm">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-semibold">Tratativas Pendentes</CardTitle>
            <Link
              href="/operador/tratativas"
              className="text-xs font-medium text-primary hover:underline"
            >
              Ver todas →
            </Link>
          </CardHeader>
          <CardContent>
            {stats.urgentTratativas.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma tratativa pendente.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="pb-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">RV</th>
                      <th className="pb-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Decisão</th>
                      <th className="pb-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Depositante</th>
                      <th className="pb-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Aguardando</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {stats.urgentTratativas.map((t) => (
                      <tr key={t.id}>
                        <td className="py-2 font-mono font-medium text-foreground">{t.rv}</td>
                        <td className="py-2">
                          <DecisionPill decision={t.decision} />
                        </td>
                        <td className="py-2 text-muted-foreground">{t.depositorName ?? '—'}</td>
                        <td className="py-2 font-medium tabular-nums text-amber-600">
                          {formatWaiting(t.decidedAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
