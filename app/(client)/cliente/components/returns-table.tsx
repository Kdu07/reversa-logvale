'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { CountdownTimer } from './countdown-timer'
import { DecisionModal } from './decision-modal'
import { PhotoGallery } from '@/components/shared/photo-gallery'
import type { ReturnRow, DepositorOption } from '../actions'
import type { ReturnDecision } from '@/types'

interface ReturnsTableProps {
  rows:              ReturnRow[]
  total:             number
  depositors:        DepositorOption[]
  currentPage:       number
  currentDepositor:  string
  currentFrom:       string
  currentTo:         string
  mode:              'pending' | 'history'
}

const DECISION_BUTTONS: { decision: ReturnDecision; label: string; className: string }[] = [
  { decision: 'return_to_stock',    label: 'Estoque',   className: 'bg-green-600 hover:bg-green-700 text-white' },
  { decision: 'store_for_handling', label: 'Armazenar', className: 'bg-amber-500 hover:bg-amber-600 text-white' },
  { decision: 'discard',            label: 'Descarte',  className: 'bg-red-600   hover:bg-red-700   text-white' },
  { decision: 'repackage',          label: 'Reembalar', className: 'bg-primary   hover:bg-primary/90 text-white' },
]

const DECISION_BADGE: Record<string, string> = {
  return_to_stock:    'bg-green-100 text-green-800 border-green-300',
  store_for_handling: 'bg-amber-100 text-amber-800 border-amber-300',
  discard:            'bg-red-100   text-red-800   border-red-300',
  repackage:          'bg-blue-100  text-blue-800  border-blue-300',
}

const DECISION_LABELS: Record<string, string> = {
  return_to_stock:    'Voltar pro Estoque',
  store_for_handling: 'Armazenar p/ Tratativas',
  discard:            'Descarte',
  repackage:          'Reembalagem',
}

const PAGE_SIZE = 50

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function IdentifierTag({ row }: { row: ReturnRow }) {
  if (row.identifierType === 'access_key') {
    return (
      <span className="inline-flex flex-col gap-0.5">
        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Chave NF</span>
        <span className="font-mono text-xs break-all">{row.accessKey?.slice(0, 20)}…</span>
      </span>
    )
  }
  if (row.identifierType === 'postal_code') {
    return (
      <span className="inline-flex flex-col gap-0.5">
        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">CEP</span>
        <span className="font-mono text-xs">{row.postalCode}</span>
      </span>
    )
  }
  return (
    <span className="inline-flex flex-col gap-0.5">
      <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Ilegível</span>
      <span className="font-mono text-xs">{row.illegibleToken}</span>
    </span>
  )
}

function PhotoThumbs({ urls, onOpen }: { urls: string[]; onOpen: (i: number) => void }) {
  if (urls.length === 0) return <span className="text-xs text-muted-foreground">—</span>
  return (
    <div className="flex gap-1 flex-wrap">
      {urls.slice(0, 3).map((url, i) => (
        <button
          key={i}
          type="button"
          onClick={() => onOpen(i)}
          className="w-10 h-10 rounded overflow-hidden border hover:ring-2 hover:ring-primary focus:ring-2 focus:ring-primary focus:outline-none"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt={`foto ${i + 1}`} className="w-full h-full object-cover" />
        </button>
      ))}
      {urls.length > 3 && (
        <button
          type="button"
          onClick={() => onOpen(0)}
          className="w-10 h-10 rounded border bg-muted flex items-center justify-center text-xs text-muted-foreground hover:bg-muted/80"
        >
          +{urls.length - 3}
        </button>
      )}
    </div>
  )
}

export function ReturnsTable({
  rows,
  total,
  depositors,
  currentPage,
  currentDepositor,
  currentFrom,
  currentTo,
  mode,
}: ReturnsTableProps) {
  const router = useRouter()
  const [selectedDecision, setSelectedDecision] = useState<{ row: ReturnRow; decision: ReturnDecision } | null>(null)
  const [gallery, setGallery] = useState<{ urls: string[]; index: number } | null>(null)

  const totalPages = Math.ceil(total / PAGE_SIZE)

  function buildUrl(overrides: Record<string, string | number>) {
    const params = new URLSearchParams()
    const merged = { depositorId: currentDepositor, from: currentFrom, to: currentTo, page: currentPage, ...overrides }
    if (merged.depositorId) params.set('depositorId', String(merged.depositorId))
    if (merged.from)         params.set('from',        String(merged.from))
    if (merged.to)           params.set('to',           String(merged.to))
    if (Number(merged.page) > 1) params.set('page', String(merged.page))
    const qs = params.toString()
    return qs ? `?${qs}` : ''
  }

  function applyFilter(key: string, value: string) {
    router.push(buildUrl({ [key]: value, page: 1 }))
  }

  function clearFilters() {
    router.push('')
  }

  const hasFilters = currentDepositor || currentFrom || currentTo

  return (
    <div className="space-y-4">
      {mode === 'pending' && (
        <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          <span className="mt-0.5 shrink-0">ℹ️</span>
          <span>Devoluções sem decisão em 72h são automaticamente armazenadas para tratativas.</span>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3">
        {depositors.length > 1 && (
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">Depositante</label>
            <select
              value={currentDepositor}
              onChange={(e) => applyFilter('depositorId', e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">Todos</option>
              {depositors.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
        )}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">De</label>
          <input
            type="date"
            value={currentFrom}
            onChange={(e) => applyFilter('from', e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">Até</label>
          <input
            type="date"
            value={currentTo}
            onChange={(e) => applyFilter('to', e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        {hasFilters && (
          <Button type="button" variant="ghost" size="sm" onClick={clearFilters} className="text-muted-foreground">
            Limpar filtros
          </Button>
        )}
        <div className="ml-auto text-sm text-muted-foreground self-end pb-1">
          {total} {total === 1 ? 'devolução' : 'devoluções'}
        </div>
      </div>

      {/* Table */}
      {rows.length === 0 ? (
        <div className="rounded-lg border bg-card p-8 text-center text-muted-foreground text-sm">
          {mode === 'pending' ? 'Nenhuma devolução pendente.' : 'Nenhuma decisão registrada.'}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="px-3 py-2 text-left font-medium text-muted-foreground whitespace-nowrap">Data</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Identificador</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">NF</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground whitespace-nowrap">RV</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Itens</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground whitespace-nowrap">Fotos Caixa</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground whitespace-nowrap">Fotos Itens</th>
                {mode === 'pending' && (
                  <>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">Decisão</th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground whitespace-nowrap">Tempo Restante</th>
                  </>
                )}
                {mode === 'history' && (
                  <>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">Decisão</th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground whitespace-nowrap">Decidido em</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b last:border-0 hover:bg-muted/20">
                  <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">
                    {formatDate(row.receivedAt)}
                  </td>
                  <td className="px-3 py-2">
                    <IdentifierTag row={row} />
                  </td>
                  <td className="px-3 py-2">
                    {row.invoiceXmlUrl ? (
                      <a
                        href={row.invoiceXmlUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline text-xs"
                      >
                        XML
                      </a>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <span className="font-mono text-xs">{row.rv}</span>
                  </td>
                  <td className="px-3 py-2 text-center">{row.itemCount}</td>
                  <td className="px-3 py-2">
                    <PhotoThumbs
                      urls={row.boxPhotoUrls}
                      onOpen={(i) => setGallery({ urls: row.boxPhotoUrls, index: i })}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <PhotoThumbs
                      urls={row.itemPhotoUrls}
                      onOpen={(i) => setGallery({ urls: row.itemPhotoUrls, index: i })}
                    />
                  </td>
                  {mode === 'pending' && (
                    <>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-1">
                          {DECISION_BUTTONS.map((btn) => (
                            <button
                              key={btn.decision}
                              type="button"
                              onClick={() => setSelectedDecision({ row, decision: btn.decision })}
                              className={`px-2 py-1 rounded text-xs font-medium transition-opacity ${btn.className}`}
                            >
                              {btn.label}
                            </button>
                          ))}
                        </div>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <CountdownTimer receivedAt={row.receivedAt} />
                      </td>
                    </>
                  )}
                  {mode === 'history' && (
                    <>
                      <td className="px-3 py-2">
                        {row.decision ? (
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-medium ${DECISION_BADGE[row.decision] ?? ''}`}>
                            {DECISION_LABELS[row.decision] ?? row.decision}
                            {row.decidedByType === 'auto' && (
                              <span className="ml-1 text-[10px] opacity-70">Auto</span>
                            )}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-muted-foreground text-xs">
                        {row.decidedAt ? formatDate(row.decidedAt) : '—'}
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={currentPage <= 1}
            onClick={() => router.push(buildUrl({ page: currentPage - 1 }))}
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
            onClick={() => router.push(buildUrl({ page: currentPage + 1 }))}
          >
            Próxima →
          </Button>
        </div>
      )}

      {/* Modals */}
      {selectedDecision && (
        <DecisionModal
          row={selectedDecision.row}
          decision={selectedDecision.decision}
          onClose={() => setSelectedDecision(null)}
          onSuccess={() => {
            setSelectedDecision(null)
            router.refresh()
          }}
        />
      )}

      {gallery && (
        <PhotoGallery
          urls={gallery.urls}
          currentIndex={gallery.index}
          onNavigate={(i) => setGallery({ ...gallery, index: i })}
          onClose={() => setGallery(null)}
        />
      )}
    </div>
  )
}
