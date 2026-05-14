'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { useBarcodeScanner } from '@/hooks/use-barcode-scanner'
import { useAudioFeedback } from '@/hooks/use-audio-feedback'
import { DetailsModal } from './details-modal'
import type { TrativaRow } from '../actions'
import type { ReturnDecision } from '@/types'

interface TrativasListProps {
  rows:        TrativaRow[]
  total:       number
  currentRv:   string
  currentPage: number
}

const DECISION_META: Record<ReturnDecision, { label: string; badge: string }> = {
  return_to_stock:    { label: 'Voltar pro Estoque',      badge: 'bg-green-100 text-green-800 border-green-300' },
  store_for_handling: { label: 'Armazenar p/ Tratativas', badge: 'bg-amber-100 text-amber-800 border-amber-300' },
  discard:            { label: 'Descarte',                badge: 'bg-red-100   text-red-800   border-red-300'   },
  repackage:          { label: 'Reembalagem',             badge: 'bg-blue-100  text-blue-800  border-blue-300'  },
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
    if (rv)     params.set('rv',   rv)
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
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-primary">Tratativas</h1>
          {total > 0 && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-primary/10 text-primary text-sm font-medium">
              {total} pendente{total !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      {/* Busca RV */}
      <div className="flex gap-2">
        <div className="relative flex-1 max-w-sm">
          <input
            ref={inputRef}
            type="text"
            value={rvInput}
            onChange={(e) => setRvInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') submitSearch(rvInput) }}
            placeholder="Buscar por RV..."
            className="w-full h-10 rounded-md border border-input bg-background px-3 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          {rvInput && (
            <button
              type="button"
              onClick={() => { setRvInput(''); router.push('') }}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-sm"
            >
              ✕
            </button>
          )}
        </div>
        <Button
          type="button"
          onClick={() => submitSearch(rvInput)}
          className="bg-primary hover:bg-primary/90 text-primary-foreground"
        >
          Buscar
        </Button>
      </div>

      {/* Tabela */}
      {rows.length === 0 ? (
        <div className="rounded-lg border bg-card p-8 text-center text-muted-foreground text-sm">
          {currentRv
            ? `Nenhuma tratativa encontrada para RV "${currentRv}".`
            : 'Nenhuma tratativa pendente.'}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">RV</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Decisão</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground whitespace-nowrap">Data Decisão</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Depositante</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Cliente</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const meta = DECISION_META[row.decision]
                return (
                  <tr key={row.id} className="border-b last:border-0 hover:bg-muted/20">
                    <td className="px-3 py-2">
                      <span className="font-mono font-medium">{row.rv}</span>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-xs font-medium ${meta.badge}`}>
                          {meta.label}
                        </span>
                        {row.decidedByType === 'auto' && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded border border-slate-300 bg-slate-100 text-slate-500 text-[10px] font-medium">
                            Auto
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">
                      {formatDate(row.decidedAt)}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {row.depositorName ?? '—'}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {row.clientName ?? (row.decidedByType === 'auto' ? 'Auto' : '—')}
                    </td>
                    <td className="px-3 py-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedRow(row)}
                        className="text-xs"
                      >
                        Ver detalhes
                      </Button>
                    </td>
                  </tr>
                )
              })}
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
          >
            ← Anterior
          </Button>
          <span className="text-sm text-muted-foreground">
            {currentPage} / {totalPages}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={currentPage >= totalPages}
            onClick={() => router.push(buildUrl(currentRv, currentPage + 1))}
          >
            Próxima →
          </Button>
        </div>
      )}

      {/* Modal de detalhes */}
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
