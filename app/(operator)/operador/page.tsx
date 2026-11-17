import Link from 'next/link'
import { getCurrentUser } from '@/lib/supabase/get-current-user'
import { getOperatorHomeStatsAction, type OperatorHomeStats } from './actions'
import { getTrativaDepositorsAction, type TrativaDepositor } from './tratativas/actions'
import { TratativasDepositorFilter } from './components/tratativas-depositor-filter'
import { PageHeader } from '@/components/shared/page-header'
import { StatCard } from '@/components/shared/stat-card'
import { DecisionPill } from '@/components/shared/decision-pill'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { DECISION_LABELS, RETURN_DECISIONS } from '@/lib/decisions'
import { myReturnsHref, parseDepositorParam, tratativasHref } from '@/lib/operator-home'
import { cn } from '@/lib/utils'
import type { ReturnDecision } from '@/types'
import {
  PackageCheck, ClipboardList, Boxes, CalendarDays, CalendarClock, TriangleAlert,
  PackageOpen, CircleCheck, Hourglass, KeyRound, ArrowRight, UserRound, Activity,
  type LucideIcon,
} from 'lucide-react'

// Ponto colorido de cada decisão (mesmos tons da DecisionPill).
const DECISION_DOT: Record<ReturnDecision, string> = {
  return_to_stock:    'bg-emerald-400',
  store_for_handling: 'bg-amber-400',
  discard:            'bg-red-400',
  repackage:          'bg-sky-400',
  reship:             'bg-sky-400',
}

/** Tempo desde a decisão; só ganha cor quando passa de 1 dia (âmbar) ou 3 dias (vermelho). */
function waitingBadge(decidedAt: string): { label: string; className: string } {
  const hours = Math.floor((Date.now() - new Date(decidedAt).getTime()) / (1000 * 60 * 60))
  const label = hours < 1 ? '<1h' : hours < 24 ? `${hours}h` : `${Math.floor(hours / 24)}d`
  const className =
    hours < 24 ? 'text-muted-foreground'
    : hours < 72 ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400'
    : 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400'
  return { label, className }
}

function SectionTitle({ icon: Icon, children }: { icon: LucideIcon; children: React.ReactNode }) {
  return (
    <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
      <Icon className="h-4 w-4 text-muted-foreground" />
      {children}
    </h2>
  )
}

export default async function OperatorHomePage({
  searchParams,
}: {
  searchParams: { depositor?: string }
}) {
  const depositorId = parseDepositorParam(searchParams.depositor)
  const user        = await getCurrentUser()
  const firstName   = user.profile.full_name.split(' ')[0]
  const [stats, depositors] = await Promise.all([
    getOperatorHomeStatsAction({ depositorId }),
    getTrativaDepositorsAction(),
  ])
  const pending = 'error' in stats ? 0 : stats.tratativas.pending

  return (
    <div className="space-y-8">
      <PageHeader
        title={`Olá, ${firstName}`}
        description="Resumo da operação. Clique em um número para ver a lista."
        className="pb-0"
        actions={
          <>
            <Button asChild size="sm">
              <Link href="/operador/recebimento">
                <PackageCheck />
                Novo recebimento
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href="/operador/tratativas">
                <ClipboardList />
                Tratativas
                {pending > 0 && (
                  <span className="ml-0.5 rounded-full bg-amber-100 px-1.5 py-px text-[11px] font-semibold tabular-nums text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                    {pending}
                  </span>
                )}
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href="/operador/minhas-devolucoes">
                <Boxes />
                Minhas devoluções
              </Link>
            </Button>
          </>
        }
      />

      {'error' in stats ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-6 text-center text-sm text-destructive">
          Erro ao carregar o resumo: {stats.error}
        </div>
      ) : (
        <OverviewSections stats={stats} depositors={depositors} />
      )}
    </div>
  )
}

function OverviewSections({ stats, depositors }: { stats: OperatorHomeStats; depositors: TrativaDepositor[] }) {
  const { ranges, mine, tratativas, awaiting } = stats
  const monthFilter = { from: ranges.monthStart, to: ranges.today }
  const depositor   = tratativas.depositorId ?? undefined

  return (
    <>
      {/* Produção do próprio operador */}
      <section className="space-y-3">
        <SectionTitle icon={UserRound}>Minha produção</SectionTitle>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard
            label="Hoje"
            value={mine.today}
            hint="recebidas por mim"
            icon={CalendarClock}
            accent="sky"
            href={myReturnsHref({ from: ranges.today, to: ranges.today })}
          />
          <StatCard
            label="Este mês"
            value={mine.month}
            hint="recebidas por mim"
            icon={CalendarDays}
            accent="sky"
            href={myReturnsHref(monthFilter)}
          />
          <StatCard
            label="Com avaria"
            value={mine.damagedMonth}
            hint="no mês"
            icon={TriangleAlert}
            accent="amber"
            href={myReturnsHref({ ...monthFilter, condition: 'damaged' })}
          />
          <StatCard
            label="Caixas vazias"
            value={mine.emptyMonth}
            hint="no mês"
            icon={PackageOpen}
            accent="slate"
            href={myReturnsHref({ ...monthFilter, condition: 'empty' })}
          />
        </div>
      </section>

      {/* Operação geral (todos os operadores) */}
      <section className="space-y-3">
        <SectionTitle icon={Activity}>Operação</SectionTitle>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard
            label="Tratativas"
            value={tratativas.pending}
            hint="pendentes de execução"
            icon={ClipboardList}
            accent="amber"
            href={tratativasHref()}
          />
          <StatCard
            label="Concluídas hoje"
            value={tratativas.processedTodayByMe}
            hint="tratativas feitas por mim"
            icon={CircleCheck}
            accent="emerald"
          />
          <StatCard
            label="Aguardando cliente"
            value={awaiting.total}
            hint="sem decisão ainda"
            icon={Hourglass}
            accent="sky"
            href={myReturnsHref({ scope: 'pending' })}
          />
          <StatCard
            label="Sem chave de acesso"
            value={awaiting.withoutKey}
            hint="aguardando cliente"
            icon={KeyRound}
            accent="slate"
            href={myReturnsHref({ scope: 'pending', withoutKey: true })}
          />
        </div>
      </section>

      {/* Tratativas pendentes — as decididas mais recentemente primeiro */}
      <Card className="overflow-hidden shadow-elev-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400">
              <ClipboardList className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-sm font-semibold text-foreground">Tratativas pendentes</h2>
              <p className="text-xs text-muted-foreground">Decididas mais recentemente primeiro</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <TratativasDepositorFilter depositors={depositors} current={tratativas.depositorId ?? ''} />
            <Link
              href={tratativasHref({ depositor })}
              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              Ver todas ({tratativas.filteredPending})
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </div>

        <div className="space-y-4 p-5">
          {/* Por decisão */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            {RETURN_DECISIONS.map((decision) => {
              const n = tratativas.byDecision[decision]
              const body = (
                <>
                  <span className="flex items-center gap-1.5 truncate text-xs font-medium text-muted-foreground">
                    <span className={cn('h-2 w-2 shrink-0 rounded-full', DECISION_DOT[decision])} />
                    {DECISION_LABELS[decision]}
                  </span>
                  <span className="text-2xl font-semibold tabular-nums leading-none text-foreground">{n}</span>
                </>
              )
              const base = 'flex flex-col gap-1.5 rounded-lg border px-3 py-2.5'
              return n > 0 ? (
                <Link
                  key={decision}
                  href={tratativasHref({ decision, depositor })}
                  className={cn(base, 'border-border bg-card transition-colors ease-quint hover:border-primary/30 hover:bg-muted/40')}
                >
                  {body}
                </Link>
              ) : (
                <span key={decision} className={cn(base, 'border-dashed border-border opacity-50')}>
                  {body}
                </span>
              )
            })}
          </div>

          {tratativas.recent.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
              {depositor ? 'Nenhuma tratativa pendente para este depositante.' : 'Nenhuma tratativa pendente.'}
            </p>
          ) : (
            <div>
              <div className="grid grid-cols-[minmax(0,8rem)_auto_minmax(0,1fr)_auto] gap-3 border-b px-3 pb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                <span>RV</span>
                <span>Decisão</span>
                <span>Depositante</span>
                <span className="text-right">Aguardando</span>
              </div>
              <ul className="divide-y divide-border">
                {tratativas.recent.map((t) => {
                  const waiting = waitingBadge(t.decidedAt)
                  return (
                    <li key={t.id}>
                      <Link
                        href={tratativasHref({ rv: t.rv, open: t.id })}
                        className="grid grid-cols-[minmax(0,8rem)_auto_minmax(0,1fr)_auto] items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ease-quint hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <span className="truncate font-mono font-medium text-foreground">{t.rv}</span>
                        <DecisionPill decision={t.decision} />
                        <span className="truncate text-muted-foreground">{t.depositorName ?? '—'}</span>
                        <span className={cn('justify-self-end rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums', waiting.className)}>
                          {waiting.label}
                        </span>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}
        </div>
      </Card>
    </>
  )
}
