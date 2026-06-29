'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { DecisionPill } from '@/components/shared/decision-pill'
import { EmptyState } from '@/components/shared/empty-state'
import { useBarcodeScanner } from '@/hooks/use-barcode-scanner'
import { useAudioFeedback } from '@/hooks/use-audio-feedback'
import { DetailsModal } from './details-modal'
import { formatDate } from '@/lib/format'
import { ptBR } from '@/lib/i18n/pt-BR'
import { Boxes, Search, X, ChevronLeft, ChevronRight } from 'lucide-react'
import type { ReturnStatus } from '@/types'
import type { MyReturnRow, MyReturnDepositor } from '../actions'

const PAGE_SIZE = 50

const STATUS_LABELS: Record<ReturnStatus, string> = {
  awaiting_decision: ptBR.returnStatus.awaiting_decision,
  decided:           ptBR.returnStatus.decided,
  processed:         ptBR.returnStatus.processed,
}

const STATUS_CLASS: Record<ReturnStatus, string> = {
  awaiting_decision: 'border-warning/40 bg-warning/10 text-warning-foreground dark:text-warning',
  decided:           'border-info/30 bg-info/10 text-info',
  processed:         'border-success/30 bg-success/10 text-success',
}

interface Props {
  rows:             MyReturnRow[]
  total:            number
  depositors:       MyReturnDepositor[]
  currentRv:        string
  currentDepositor: string
  currentFrom:      string
  currentTo:        string
  currentPage:      number
}

export function MyReturnsList({
  rows, total, depositors, currentRv, currentDepositor, currentFrom, currentTo, currentPage,
}: Props) {
  const router    = useRouter()
  const inputRef  = useRef<HTMLInputElement>(null)
  const [rvInput, setRvInput]         = useState(currentRv)
  const [selectedRow, setSelectedRow] = useState<MyReturnRow | null>(null)
  const { beep } = useAudioFeedback()

  useEffect(() => { inputRef.current?.focus() }, [])

  function buildUrl(
    next: Partial<{ rv: string; depositor: string; from: string; to: string; page: number }>,
  ) {
    const rv        = next.rv        ?? currentRv
    const depositor = next.depositor ?? currentDepositor
    const from      = next.from      ?? currentFrom
    const to        = next.to        ?? currentTo
    const page      = next.page      ?? 1

    const p = new URLSearchParams()
    if (rv)        p.set('rv', rv)
    if (depositor) p.set('depositor', depositor)
    if (from)      p.set('from', from)
    if (to)        p.set('to', to)
    if (page > 1)  p.set('page', String(page))
    const qs = p.toString()
    return `/operador/minhas-devolucoes${qs ? `?${qs}` : ''}`
  }

  function submitSearch(rv: string) {
    router.push(buildUrl({ rv: rv.trim(), page: 1 }))
  }

  useBarcodeScanner({
    onScan: (rv) => {
      setRvInput(rv)
      beep('success')
      submitSearch(rv)
    },
    minLength: 2,
  })

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const hasFilters = !!(currentRv || currentDepositor || currentFrom || currentTo)

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex gap-3 flex-wrap items-end">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Buscar RV</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <input
              ref={inputRef}
              type="text"
              value={rvInput}
              onChange={(e) => setRvInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') submitSearch(rvInput) }}
              placeholder="Buscar por RV..."
              className="h-9 w-48 rounded-md border border-input bg-background pl-9 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground"
            />
            {rvInput && (
              <button
                type="button"
                onClick={() => { setRvInput(''); router.push(buildUrl({ rv: '', page: 1 })) }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Depositante</label>
          <select
            className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            value={currentDepositor}
            onChange={(e) => router.push(buildUrl({ depositor: e.target.value, page: 1 }))}
          >
            <option value="">Todos os depositantes</option>
            {depositors.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">De</label>
          <input
            type="date"
            value={currentFrom}
            max={currentTo || undefined}
            onChange={(e) => router.push(buildUrl({ from: e.target.value, page: 1 }))}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Até</label>
          <input
            type="date"
            value={currentTo}
            min={currentFrom || undefined}
            onChange={(e) => router.push(buildUrl({ to: e.target.value, page: 1 }))}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {hasFilters && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => { setRvInput(''); router.push('/operador/minhas-devolucoes') }}
            className="h-9"
          >
            Limpar filtros
          </Button>
        )}

        <Badge variant="secondary" className="ml-auto self-center">
          {total} devoluç{total !== 1 ? 'ões' : 'ão'}
        </Badge>
      </div>

      {/* Tabela */}
      {rows.length === 0 ? (
        <EmptyState
          icon={Boxes}
          title="Nenhuma devolução"
          description={hasFilters
            ? 'Nenhuma devolução encontrada com os filtros aplicados.'
            : 'Você ainda não registrou nenhuma devolução.'}
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30 text-left">
                <th className="px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap">Data</th>
                <th className="px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">RV</th>
                <th className="px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                <th className="px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Decisão</th>
                <th className="px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Depositante</th>
                <th className="px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wider text-right">Itens</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((row) => (
                <tr key={row.id} className="hover:bg-muted/30 transition-colors ease-quint">
                  <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap text-xs">{formatDate(row.receivedAt)}</td>
                  <td className="px-4 py-2.5 font-mono font-medium text-foreground">{row.rv}</td>
                  <td className="px-4 py-2.5">
                    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${STATUS_CLASS[row.status]}`}>
                      <span className="h-1.5 w-1.5 rounded-full bg-current" />
                      {STATUS_LABELS[row.status]}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    {row.decision
                      ? <DecisionPill decision={row.decision} />
                      : <span className="text-xs text-muted-foreground">—</span>}
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">{row.depositorName ?? '—'}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">{row.itemCount}</td>
                  <td className="px-4 py-2.5 text-right">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedRow(row)}
                      className="text-xs h-7"
                    >
                      Ver detalhes
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Paginação */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={currentPage <= 1}
            onClick={() => router.push(buildUrl({ page: currentPage - 1 }))}
            className="gap-1"
          >
            <ChevronLeft className="h-4 w-4" />
            Anterior
          </Button>
          <span className="text-sm text-muted-foreground px-2">{currentPage} / {totalPages}</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={currentPage >= totalPages}
            onClick={() => router.push(buildUrl({ page: currentPage + 1 }))}
            className="gap-1"
          >
            Próxima
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {selectedRow && (
        <DetailsModal row={selectedRow} onClose={() => setSelectedRow(null)} />
      )}
    </div>
  )
}
