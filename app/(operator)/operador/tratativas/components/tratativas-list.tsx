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
import { ClipboardList, Search, X, ChevronLeft, ChevronRight } from 'lucide-react'
import type { TrativaRow } from '../actions'

interface TrativasListProps {
  rows:        TrativaRow[]
  total:       number
  currentRv:   string
  currentPage: number
}

const PAGE_SIZE = 50

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export function TrativasList({ rows, total, currentRv, currentPage }: TrativasListProps) {
  const router       = useRouter()
  const inputRef     = useRef<HTMLInputElement>(null)
  const [rvInput, setRvInput]         = useState(currentRv)
  const [selectedRow, setSelectedRow] = useState<TrativaRow | null>(null)
  const { beep }     = useAudioFeedback()

  useEffect(() => { inputRef.current?.focus() }, [])

  function buildUrl(rv: string, page: number) {
    const params = new URLSearchParams()
    if (rv)       params.set('rv',   rv)
    if (page > 1) params.set('page', String(page))
    const qs = params.toString()
    return qs ? `?${qs}` : ''
  }

  function submitSearch(rv: string) {
    router.push(buildUrl(rv.trim(), 1))
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
      <div className="flex gap-2">
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
              onClick={() => { setRvInput(''); router.push('') }}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <Button type="button" size="sm" onClick={() => submitSearch(rvInput)}>
          Buscar
        </Button>
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
          onClose={() => setSelectedRow(null)}
          onComplete={() => {
            setSelectedRow(null)
            router.refresh()
          }}
        />
      )}
    </div>
  )
}
