'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { DecisionPill } from '@/components/shared/decision-pill'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/shared/empty-state'
import { useBarcodeScanner } from '@/hooks/use-barcode-scanner'
import { useAudioFeedback } from '@/hooks/use-audio-feedback'
import { DetailsModal } from './details-modal'
import { DECISION_LABELS, RETURN_DECISIONS } from '@/lib/decisions'
import { ClipboardList, Search, X, ChevronLeft, ChevronRight } from 'lucide-react'
import type { ReturnDecision } from '@/types'
import type { TrativaRow, TrativaDepositor } from '../actions'

interface TrativasListProps {
  rows:            TrativaRow[]
  total:           number
  currentRv:       string
  currentDecision: ReturnDecision | ''
  depositors:      TrativaDepositor[]
  currentDepositor: string
  currentPage:     number
  /** Abre o modal desta devolução ao carregar (vindo da visão geral). */
  openId?:         string
}

const PAGE_SIZE = 50

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export function TrativasList({
  rows, total, currentRv, currentDecision, depositors, currentDepositor, currentPage, openId = '',
}: TrativasListProps) {
  const router       = useRouter()
  const inputRef     = useRef<HTMLInputElement>(null)
  const openedIdRef  = useRef<string>('')
  const [rvInput, setRvInput]         = useState(currentRv)
  const [selectedRow, setSelectedRow] = useState<TrativaRow | null>(null)
  const { beep }     = useAudioFeedback()

  useEffect(() => { inputRef.current?.focus() }, [])

  // Link da visão geral (`?open=<id>`): abre o modal daquela devolução uma vez.
  useEffect(() => {
    if (!openId || openedIdRef.current === openId) return
    const row = rows.find((r) => r.id === openId)
    if (row) {
      openedIdRef.current = openId
      setSelectedRow(row)
    }
  }, [openId, rows])

  function buildUrl(
    rv: string,
    page: number,
    decision: ReturnDecision | '' = currentDecision,
    depositor: string = currentDepositor,
  ) {
    const params = new URLSearchParams()
    if (rv)        params.set('rv',        rv)
    if (decision)  params.set('decision',  decision)
    if (depositor) params.set('depositor', depositor)
    if (page > 1)  params.set('page',      String(page))
    const qs = params.toString()
    return `/operador/tratativas${qs ? `?${qs}` : ''}`
  }

  function submitSearch(rv: string) {
    router.push(buildUrl(rv.trim(), 1))
  }

  /** Fecha o modal; se veio por `?open=`, tira o parâmetro para não reabrir. */
  function closeModal(processed: boolean) {
    setSelectedRow(null)
    if (openId) router.replace(buildUrl(currentRv, currentPage), { scroll: false })
    else if (processed) router.refresh()
  }

  useBarcodeScanner({
    onScan: (rv) => {
      setRvInput(rv)
      beep('success')
      submitSearch(rv)
    },
    minLength: 2,
  })

  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <div className="space-y-4">
      {/* Busca RV */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <input
            ref={inputRef}
            type="text"
            value={rvInput}
            onChange={(e) => setRvInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') submitSearch(rvInput) }}
            placeholder="Buscar por RV..."
            className="w-full h-9 rounded-md border border-input bg-background pl-9 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground"
          />
          {rvInput && (
            <button
              type="button"
              onClick={() => { setRvInput(''); router.push(buildUrl('', 1)) }}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <Button type="button" size="sm" onClick={() => submitSearch(rvInput)}>
          Buscar
        </Button>
        <select
          aria-label="Filtrar por decisão"
          className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          value={currentDecision}
          onChange={(e) => router.push(buildUrl(currentRv, 1, e.target.value as ReturnDecision | ''))}
        >
          <option value="">Todas as decisões</option>
          {RETURN_DECISIONS.map((d) => (
            <option key={d} value={d}>{DECISION_LABELS[d]}</option>
          ))}
        </select>
        <select
          aria-label="Filtrar por depositante"
          className="h-9 max-w-[16rem] rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          value={currentDepositor}
          onChange={(e) => router.push(buildUrl(currentRv, 1, currentDecision, e.target.value))}
        >
          <option value="">Todos os depositantes</option>
          {/* Filtro ativo de um depositante que já não tem pendências continua selecionável. */}
          {currentDepositor && !depositors.some((d) => d.id === currentDepositor) && (
            <option value={currentDepositor}>Depositante selecionado (0)</option>
          )}
          {depositors.map((d) => (
            <option key={d.id} value={d.id}>{d.name} ({d.count})</option>
          ))}
        </select>
        {total > 0 && (
          <Badge variant="secondary" className="ml-auto self-center">
            {total} pendente{total !== 1 ? 's' : ''}
          </Badge>
        )}
      </div>

      {/* Tabela */}
      {rows.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="Nenhuma tratativa"
          description={currentRv
            ? `Nenhuma tratativa encontrada para RV "${currentRv}".`
            : currentDecision || currentDepositor
              ? 'Nenhuma tratativa pendente com os filtros selecionados.'
              : 'Todas as tratativas foram concluídas.'}
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">RV</th>
                <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Decisão</th>
                <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap">Data Decisão</th>
                <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Depositante</th>
                <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Cliente</th>
                <th className="px-3 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((row) => (
                <tr key={row.id} className="hover:bg-muted/30 transition-colors ease-quint">
                  <td className="px-3 py-2.5">
                    <span className="font-mono font-medium text-foreground">{row.rv}</span>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <DecisionPill decision={row.decision} />
                      {row.decidedByType === 'auto' && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Auto</Badge>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap text-muted-foreground">
                    {formatDate(row.decidedAt)}
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground">
                    {row.depositorName ?? '—'}
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground">
                    {row.clientName ?? (row.decidedByType === 'auto' ? 'Auto' : '—')}
                  </td>
                  <td className="px-3 py-2.5 text-right">
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
            onClick={() => router.push(buildUrl(currentRv, currentPage - 1))}
            className="gap-1"
          >
            <ChevronLeft className="h-4 w-4" />
            Anterior
          </Button>
          <span className="text-sm text-muted-foreground px-2">
            {currentPage} / {totalPages}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={currentPage >= totalPages}
            onClick={() => router.push(buildUrl(currentRv, currentPage + 1))}
            className="gap-1"
          >
            Próxima
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {selectedRow && (
        <DetailsModal
          row={selectedRow}
          onClose={() => closeModal(false)}
          onComplete={() => closeModal(true)}
        />
      )}
    </div>
  )
}
