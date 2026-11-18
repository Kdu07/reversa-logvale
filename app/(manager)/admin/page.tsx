import Link from 'next/link'
import dynamic from 'next/dynamic'
import { PageHeader } from '@/components/shared/page-header'
import { StatCard } from '@/components/shared/stat-card'
import { Button } from '@/components/ui/button'
import { DECISION_LABELS } from '@/lib/decisions'
import { ptBR } from '@/lib/i18n/pt-BR'
import { cn } from '@/lib/utils'
import { resolveDashboardFilters } from '@/lib/admin-dashboard/filters'
import type { AdminDashboardData, ConditionKey } from '@/lib/admin-dashboard/types'
import { todayValue } from '@/lib/reports/period'
import type { ReturnDecision } from '@/types'
import {
  Section, Panel, KpiTile, SegmentedBar, BarList, formatHours, fmtInt, fmtPct,
} from './components/dashboard/dashboard-ui'
import { UrgentDepositorFilter } from './components/dashboard/urgent-depositor-filter'
import { PeriodFilterBar } from './components/dashboard/period-filter-bar'
import { getAdminDashboardAction } from './actions'
import {
  Hourglass, ClipboardList, KeyRound, MailWarning, Siren, BarChart3, ShieldCheck,
  Building2, Users, FileSpreadsheet,
} from 'lucide-react'

const ReceivedChart = dynamic(
  () => import('./components/dashboard/received-chart').then((m) => m.ReceivedChart),
  { ssr: false, loading: () => <div className="h-[220px] animate-pulse rounded-lg bg-muted" /> },
)

// Mesmos tons da home do operador / DecisionPill.
const DECISION_BAR: Record<ReturnDecision, string> = {
  return_to_stock:    'bg-emerald-400',
  store_for_handling: 'bg-amber-400',
  discard:            'bg-red-400',
  repackage:          'bg-sky-400',
  reship:             'bg-sky-400',
}

// Mesmos tons do ItemConditionBadge.
const CONDITION_META: Record<ConditionKey, { label: string; color: string }> = {
  good:       { label: 'Bom',                     color: 'bg-emerald-400' },
  damaged:    { label: 'Avaria',                  color: 'bg-amber-400' },
  empty:      { label: 'Caixa vazia',             color: 'bg-slate-400' },
  mismatched: { label: 'Produto não corresponde', color: 'bg-violet-400' },
}

/** "Avaria · 3 itens avariados" — o que `items` conta muda por estado. */
function conditionLabel(condition: ConditionKey, items: number): string {
  const base = CONDITION_META[condition].label
  if (condition === 'empty') return base
  const noun = items === 1 ? 'item' : 'itens'
  const suffix = condition === 'damaged' ? (items === 1 ? ' avariado' : ' avariados') : ''
  return `${base} · ${fmtInt(items)} ${noun}${suffix}`
}

/** Link para a lista de devoluções do admin com os filtros que ela lê (`lib/admin-returns-filters.ts`). */
function returnsHref(params: Record<string, string>) {
  return `/admin/devolucoes?${new URLSearchParams(params).toString()}`
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-muted-foreground">{children}</p>
}

export default async function ManagerDashboardPage({
  searchParams,
}: {
  searchParams: { period?: string; from?: string; to?: string; dep?: string; udep?: string }
}) {
  const filters = resolveDashboardFilters(searchParams)
  const data    = await getAdminDashboardAction(filters)

  return (
    <div className="space-y-8">
      <PageHeader
        title="Dashboard"
        description="O que precisa de ação agora e como a operação andou no período."
        className="pb-0"
        actions={
          <Button asChild size="sm" variant="outline">
            <Link href="/admin/relatorios">
              <FileSpreadsheet />
              Relatórios
            </Link>
          </Button>
        }
      />

      {'error' in data ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-6 text-center text-sm text-destructive">
          Erro ao carregar o dashboard: {data.error}
        </div>
      ) : (
        <>
          <AttentionSection data={data} />
          <PeriodSections data={data} periodError={filters.periodError} />
        </>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Bloco 1 — Precisa de ação agora (independe do período)              */
/* ------------------------------------------------------------------ */

function AttentionSection({ data }: { data: AdminDashboardData }) {
  const { awaiting, decidedBacklog, withoutKey, warnings24h, urgent, urgentDepositors, urgentDepositorId } = data.attention
  const urgentFilter: Record<string, string> = urgentDepositorId ? { depositor: urgentDepositorId } : {}

  return (
    <Section icon={Siren} title="Precisa de ação agora" description="Situação atual — não depende do período escolhido.">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Aguardando decisão"
          value={awaiting.total}
          hint={`${awaiting.overdue} vencidas · ${awaiting.dueSoon} vencem em <24h`}
          icon={Hourglass}
          accent="amber"
          href={returnsHref({ status: 'awaiting_decision' })}
        />
        <StatCard
          label="Decididas sem tratativa"
          value={decidedBacklog.total}
          hint={`mais antiga há ${formatHours(decidedBacklog.oldestHours)}`}
          icon={ClipboardList}
          accent="sky"
          href={returnsHref({ status: 'decided' })}
        />
        <StatCard
          label="Sem chave de acesso"
          value={withoutKey.awaiting + withoutKey.decided}
          hint={`${withoutKey.awaiting} aguardando · ${withoutKey.decided} decididas`}
          icon={KeyRound}
          accent="slate"
          href={returnsHref({ nokey: '1' })}
        />
        <StatCard
          label="Avisos de 48h"
          value={warnings24h}
          hint="enviados nas últimas 24h"
          icon={MailWarning}
          accent="emerald"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <Panel
          title="Prazo das pendentes"
          description="Aguardando decisão, pelo prazo de 72h"
          className="lg:col-span-2"
        >
          <SegmentedBar
            unit="aguardando decisão"
            segments={[
              { key: 'overdue',    label: 'Vencidas',          value: awaiting.overdue,    color: 'bg-red-500',     href: returnsHref({ deadline: 'overdue' }) },
              { key: 'dueSoon',    label: 'Vencem em < 24h',   value: awaiting.dueSoon,    color: 'bg-amber-400',   href: returnsHref({ deadline: 'soon' }) },
              { key: 'onTime',     label: 'Dentro do prazo',   value: awaiting.onTime,     color: 'bg-emerald-400' },
              { key: 'noDeadline', label: 'Sem prazo de decisão', value: awaiting.noDeadline, color: 'bg-slate-300 dark:bg-slate-600' },
            ]}
          />
        </Panel>

        <Panel
          title="Vencidas e a vencer"
          description="Mais urgentes primeiro"
          className="lg:col-span-3"
          bodyClassName="p-0"
          href={returnsHref({ deadline: 'urgent', ...urgentFilter })}
          hrefLabel="Ver todas"
          actions={
            urgentDepositors.length > 0 && (
              <UrgentDepositorFilter depositors={urgentDepositors} current={urgentDepositorId ?? ''} />
            )
          }
        >
          {urgent.length === 0 ? (
            <p className="p-5 text-sm text-muted-foreground">
              {urgentDepositorId
                ? 'Nenhuma devolução vencida ou a vencer para este depositante.'
                : 'Nenhuma devolução vencida ou a vencer nas próximas 24h.'}
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  <th className="px-5 py-2 font-medium">RV</th>
                  <th className="px-2 py-2 font-medium">Depositante</th>
                  <th className="px-5 py-2 text-right font-medium">Prazo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {urgent.map((r) => {
                  const overdue = r.hoursLeft < 0
                  return (
                    <tr key={r.id} className="transition-colors hover:bg-muted/40">
                      <td className="px-5 py-2">
                        <Link
                          href={returnsHref({ rv: r.rv })}
                          className="font-mono font-medium text-foreground hover:text-primary hover:underline"
                        >
                          {r.rv}
                        </Link>
                      </td>
                      <td className="truncate px-2 py-2 text-muted-foreground">{r.depositorName ?? '—'}</td>
                      <td className="px-5 py-2 text-right">
                        <span
                          className={cn(
                            'inline-flex rounded-full px-2 py-0.5 text-xs font-medium tabular-nums',
                            overdue
                              ? 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400'
                              : 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400',
                          )}
                        >
                          {overdue ? `vencida há ${formatHours(r.hoursLeft)}` : `vence em ${formatHours(r.hoursLeft)}`}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </Panel>
      </div>
    </Section>
  )
}

/* ------------------------------------------------------------------ */
/* Blocos 2–4 — dentro do período                                      */
/* ------------------------------------------------------------------ */

function PeriodSections({ data, periodError }: { data: AdminDashboardData; periodError: string | null }) {
  const { volume, quality, depositors, team, period } = data
  // Filtros do período que os links para a lista de devoluções carregam.
  const periodLink: Record<string, string> = {
    from: period.from,
    to:   period.to,
    ...(period.depositorId ? { depositor: period.depositorId } : {}),
  }
  const decidedTotal = (volume.decidedByClient.value ?? 0) + (volume.decidedAuto.value ?? 0)
  const autoShare    = decidedTotal > 0 ? ((volume.decidedAuto.value ?? 0) / decidedTotal) * 100 : null

  return (
    <div className="space-y-8">
      {/* Barra do período — fica acima de tudo que ela filtra */}
      <div className="flex flex-col gap-3 border-t pt-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">No período</p>
          <p className="text-xs text-muted-foreground">
            Devoluções recebidas de {period.label}
            {period.depositorName && (
              <> · <span className="font-medium text-foreground">{period.depositorName}</span></>
            )}
            {' · '}variação {period.previousLabel}
          </p>
        </div>
        <PeriodFilterBar
          period={period.key}
          from={period.from}
          to={period.to}
          depositorId={period.depositorId}
          urgentDepositorId={data.attention.urgentDepositorId}
          depositors={data.depositorOptions}
          today={todayValue()}
          serverError={periodError}
        />
      </div>

      {/* Bloco 2 — volume e tempos */}
      <Section icon={BarChart3} title="Volume e tempos">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <KpiTile label="Recebidas"           value={fmtInt(volume.received.value ?? 0)}        data={volume.received} />
          <KpiTile label="Decididas pelo cliente" value={fmtInt(volume.decidedByClient.value ?? 0)} data={volume.decidedByClient} />
          <KpiTile label="Auto-decididas"      value={fmtInt(volume.decidedAuto.value ?? 0)}     data={volume.decidedAuto} better="down" hint={autoShare !== null ? `${fmtPct(Math.round(autoShare * 10) / 10)} do total` : undefined} />
          <KpiTile label="Processadas"         value={fmtInt(volume.processed.value ?? 0)}       data={volume.processed} />
          <KpiTile label="Até a decisão"       value={formatHours(volume.medianDecisionHours.value)} data={volume.medianDecisionHours} better="down" hint="mediana · cliente" />
          <KpiTile label="Decisão → tratativa" value={formatHours(volume.medianProcessHours.value)}  data={volume.medianProcessHours}  better="down" hint="mediana" />
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <Panel
            title={volume.seriesUnit === 'hour' ? 'Recebidas por hora' : volume.seriesUnit === 'week' ? 'Recebidas por semana' : 'Recebidas por dia'}
            description={period.label}
            className="lg:col-span-2"
          >
            <ReceivedChart data={volume.series} unit={volume.seriesUnit} />
          </Panel>

          <Panel title="Decisões no período" description="Cliente + automáticas">
            {volume.byDecision.length === 0 ? <Empty>Nenhuma decisão ainda.</Empty> : <BarList
              rows={volume.byDecision.map((d) => ({
                key:   d.decision,
                label: DECISION_LABELS[d.decision],
                value: d.count,
                color: DECISION_BAR[d.decision],
                href:  returnsHref({ decision: d.decision, ...periodLink }),
              }))}
            />}
          </Panel>
        </div>
      </Section>

      {/* Bloco 3 — qualidade no recebimento */}
      <Section icon={ShieldCheck} title="Qualidade no recebimento">
        <div className="grid gap-4 lg:grid-cols-2">
          <Panel title="Estado dos produtos" description={`Por devolução · ${fmtInt(quality.totalItems)} itens recebidos no período`}>
            <SegmentedBar
              unit="devoluções"
              segments={quality.conditions.map((c) => ({
                key:   c.condition,
                label: conditionLabel(c.condition, c.items),
                value: c.returns,
                color: CONDITION_META[c.condition].color,
                href:  returnsHref({ condition: c.condition, ...periodLink }),
              }))}
            />
            {quality.notEvaluated > 0 && (
              <p className="mt-3 text-xs text-muted-foreground">
                + {fmtInt(quality.notEvaluated)} recebidas antes da etapa de estado existir (sem avaliação).
              </p>
            )}
          </Panel>

          <Panel title="Como a caixa foi identificada" description="Sem chave = NF de origem precisa ser informada depois">
            {quality.identification.length === 0 ? <Empty>Nenhuma devolução no período.</Empty> : <BarList
              rows={quality.identification.map((i) => ({
                key:   i.type,
                label: ptBR.identifierTypes[i.type] ?? i.type,
                value: i.count,
              }))}
            />}
          </Panel>
        </div>
      </Section>

      {/* Bloco 4 — depositantes e equipe */}
      <Section icon={Building2} title="Depositantes e equipe">
        <div className="grid gap-4 xl:grid-cols-3">
          <Panel title="Por depositante" description={period.depositorName ? `Filtrado: ${period.depositorName}` : 'Ordenado por volume no período'} className="xl:col-span-2" bodyClassName="p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="border-b text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    <th className="px-5 py-2 font-medium">Depositante</th>
                    <th className="px-2 py-2 text-right font-medium">Recebidas</th>
                    <th className="px-2 py-2 text-right font-medium" title="Aguardando decisão agora (independe do período)">Aguardando</th>
                    <th className="px-2 py-2 text-right font-medium" title="Decisões tomadas automaticamente após 72h">Auto</th>
                    <th className="px-2 py-2 text-right font-medium" title="Mediana do recebimento até a decisão do cliente">Decisão</th>
                    <th className="px-5 py-2 text-right font-medium" title="Devoluções com avaria / devoluções avaliadas (sem caixas vazias)">Avaria</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {depositors.length === 0 && (
                    <tr><td colSpan={6} className="px-5 py-4 text-sm text-muted-foreground">Nenhuma devolução recebida no período.</td></tr>
                  )}
                  {depositors.map((d) => (
                    <tr key={d.id} className="transition-colors hover:bg-muted/40">
                      <td className="px-5 py-2">
                        <Link
                          href={returnsHref({ from: period.from, to: period.to, depositor: d.id })}
                          className="font-medium text-foreground hover:text-primary hover:underline"
                        >
                          {d.name}
                        </Link>
                        {d.noDeadline && (
                          <span className="ml-2 rounded-full border px-1.5 py-px text-[10px] font-medium text-muted-foreground">sem prazo</span>
                        )}
                      </td>
                      <td className="px-2 py-2 text-right font-semibold tabular-nums text-foreground">{fmtInt(d.received)}</td>
                      <td className="px-2 py-2 text-right tabular-nums text-muted-foreground">{fmtInt(d.awaiting)}</td>
                      <td className="px-2 py-2 text-right tabular-nums text-muted-foreground">{d.noDeadline ? '—' : fmtPct(d.autoRate)}</td>
                      <td className="px-2 py-2 text-right tabular-nums text-muted-foreground">{formatHours(d.medianDecisionHours)}</td>
                      <td className="px-5 py-2 text-right tabular-nums">
                        <span className={cn(
                          (d.damagedRate ?? 0) >= 10
                            ? 'font-medium text-amber-700 dark:text-amber-400'
                            : 'text-muted-foreground',
                        )}>
                          {fmtPct(d.damagedRate)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>

          <Panel title="Equipe" description="Pela data em que cada atividade foi feita" bodyClassName="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  <th className="px-5 py-2 font-medium">
                    <span className="inline-flex items-center gap-1.5"><Users className="h-3.5 w-3.5" />Operador</span>
                  </th>
                  <th className="px-2 py-2 text-right font-medium" title="Devoluções recebidas">Receb.</th>
                  <th className="px-2 py-2 text-right font-medium" title="Tratativas concluídas">Trat.</th>
                  <th className="px-5 py-2 text-right font-medium" title="Correções em devoluções">Edições</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {team.length === 0 && (
                  <tr><td colSpan={4} className="px-5 py-4 text-sm text-muted-foreground">Nenhuma atividade no período.</td></tr>
                )}
                {team.map((o) => (
                  <tr key={o.id}>
                    <td className="truncate px-5 py-2 font-medium text-foreground">{o.name}</td>
                    <td className="px-2 py-2 text-right font-semibold tabular-nums text-foreground">{fmtInt(o.received)}</td>
                    <td className="px-2 py-2 text-right tabular-nums text-muted-foreground">{fmtInt(o.processed)}</td>
                    <td className="px-5 py-2 text-right tabular-nums text-muted-foreground">{fmtInt(o.edits)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>
        </div>
      </Section>
    </div>
  )
}
