import Link from 'next/link'
import { getAdminReturnsAction } from './actions'
import { ReturnsAdminTable } from './components/returns-admin-table'
import { PageHeader } from '@/components/shared/page-header'
import { createClient } from '@/lib/supabase/server'
import {
  adminReturnsHref, extraFilterChips, parseAdminReturnsParams, type AdminReturnsParams,
} from '@/lib/admin-returns-filters'
import { X } from 'lucide-react'

export default async function AdminReturnsPage({
  searchParams,
}: {
  searchParams: AdminReturnsParams
}) {
  const filters = parseAdminReturnsParams(searchParams)

  const [result, depositors] = await Promise.all([
    getAdminReturnsAction(filters),
    // Todos os depositantes (inclusive inativos): o histórico tem devoluções deles.
    createClient()
      .from('depositors')
      .select('id, razao_social, active')
      .order('razao_social')
      .then(({ data }) =>
        (data ?? []).map((d) => ({
          id:     d.id as string,
          name:   d.razao_social as string,
          active: d.active as boolean,
        })),
      ),
  ])

  // O depositante tem seu próprio seletor na barra da tabela — não vira chip.
  const chips = extraFilterChips({ ...filters, depositorId: null }, null)
  // Filtros extras viajam junto quando a tabela troca RV, status, depositante ou página.
  const extraQuery = new URLSearchParams(
    adminReturnsHref({ ...filters, rv: '', status: null, depositorId: null, page: 1 }).split('?')[1] ?? '',
  ).toString()

  return (
    <div className="space-y-6">
      <PageHeader title="Devoluções" description="Histórico e gestão de todas as devoluções." />

      {chips.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">Filtros:</span>
          {chips.map((c) => (
            <Link
              key={c.key}
              href={c.href}
              aria-label={`Remover filtro ${c.label}`}
              className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/5 px-2.5 py-0.5 text-xs font-medium text-foreground transition-colors hover:border-primary/60 hover:bg-primary/10"
            >
              {c.label}
              <X className="h-3 w-3 text-muted-foreground" />
            </Link>
          ))}
          <Link
            href={adminReturnsHref({ rv: filters.rv, status: filters.status, depositorId: filters.depositorId })}
            className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            Limpar filtros
          </Link>
        </div>
      )}

      {'error' in result ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-6 text-center text-destructive text-sm">
          Erro ao carregar devoluções: {result.error}
        </div>
      ) : (
        <ReturnsAdminTable
          rows={result.rows}
          total={result.total}
          currentRv={filters.rv}
          currentStatus={filters.status ?? ''}
          currentPage={filters.page}
          depositors={depositors}
          currentDepositor={filters.depositorId ?? ''}
          extraQuery={extraQuery}
        />
      )}
    </div>
  )
}
