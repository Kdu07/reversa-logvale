'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { CountdownTimer } from '@/components/shared/countdown-timer'
import { DecisionPill } from '@/components/shared/decision-pill'
import { EmptyState } from '@/components/shared/empty-state'
import { DecisionModal } from './decision-modal'
import { PhotoGallery } from '@/components/shared/photo-gallery'
import { PhotoThumbs } from '@/components/shared/photo-thumbs'
import { DownloadXmlButton } from '@/components/shared/download-xml-button'
import { CopyButton } from '@/components/shared/copy-button'
import { formatDate, xmlDownloadName, danfeDownloadName } from '@/lib/format'
import { Inbox, ChevronLeft, ChevronRight } from 'lucide-react'
import type { ReturnRow, DepositorOption } from '../actions'
import type { ReturnDecision, IdentifierType } from '@/types'

interface ReturnsTableProps {
  rows:             ReturnRow[]
  total:            number
  depositors:       DepositorOption[]
  currentPage:      number
  currentDepositor: string
  currentFrom:      string
  currentTo:        string
  mode:             'pending' | 'history'
}

const DECISION_BUTTONS: { decision: ReturnDecision; label: string; className: string }[] = [
  { decision: 'return_to_stock',    label: 'Estoque',   className: 'bg-green-600 hover:bg-green-700 text-white font-semibold shadow-sm' },
  { decision: 'store_for_handling', label: 'Tratativa', className: 'bg-amber-500 hover:bg-amber-600 text-white font-semibold shadow-sm' },
  { decision: 'discard',            label: 'Descarte',  className: 'bg-red-600   hover:bg-red-700   text-white font-semibold shadow-sm' },
]

const PAGE_SIZE = 50

const IDENTIFIER_TYPE_LABEL: Record<IdentifierType, string> = {
  access_key:  'Chave NF',
  postal_code: 'CEP',
  illegible:   'Ilegível',
}

function IdentifierTag({ row }: { row: ReturnRow }) {
  const label = IDENTIFIER_TYPE_LABEL[row.identifierType]
  const fullValue = row.identifierType === 'access_key'
    ? row.accessKey
    : row.identifierType === 'postal_code'
    ? row.postalCode
    : row.illegibleToken
  const display = row.identifierType === 'access_key'
    ? `${row.accessKey?.slice(0, 20)}…`
    : fullValue

  return (
    <span className="inline-flex flex-col gap-0.5">
      <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">{label}</span>
      <span className="inline-flex items-center gap-1.5">
        <span className="font-mono text-xs break-all">{display}</span>
        {fullValue && <CopyButton value={fullValue} title={`Copiar ${label}`} className="shrink-0" />}
      </span>
      {row.finalCustomerName && (
        <span className="text-[11px] text-muted-foreground truncate max-w-[200px]" title={row.finalCustomerName}>
          Cliente: {row.finalCustomerName}
        </span>
      )}
    </span>
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
  const [gallery, setGallery] = useState<{ urls: string[]; index: number; prefix?: string } | null>(null)

  const totalPages = Math.ceil(total / PAGE_SIZE)

  function buildUrl(overrides: Record<string, string | number>) {
    const params  = new URLSearchParams()
    const merged  = { depositorId: currentDepositor, from: currentFrom, to: currentTo, page: currentPage, ...overrides }
    if (merged.depositorId)          params.set('depositorId', String(merged.depositorId))
    if (merged.from)                 params.set('from',        String(merged.from))
    if (merged.to)                   params.set('to',          String(merged.to))
    if (Number(merged.page) > 1)     params.set('page',        String(merged.page))
    const qs = params.toString()
    return qs ? `?${qs}` : ''
  }

  function applyFilter(key: string, value: string) {
    router.push(buildUrl({ [key]: value, page: 1 }))
  }

  const hasFilters = currentDepositor || currentFrom || currentTo

  return (
    <div className="space-y-4">
      {mode === 'pending' && (
        <div className="flex items-start gap-2.5 rounded-lg border border-info/30 bg-info/10 px-4 py-3 text-sm text-info">
          <span className="mt-0.5 shrink-0 text-base">ℹ</span>
          <span>Devoluções sem decisão em 72h são automaticamente armazenadas para tratativas.</span>
        </div>
      )}

      {/* Filtros */}
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
          <Button type="button" variant="ghost" size="sm" onClick={() => router.push('')} className="text-muted-foreground">
            Limpar filtros
          </Button>
        )}
        <Badge variant="secondary" className="ml-auto self-end mb-0.5">
          {total} {total === 1 ? 'devolução' : 'devoluções'}
        </Badge>
      </div>

      {/* Tabela */}
      {rows.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title={mode === 'pending' ? 'Nenhuma devolução pendente' : 'Nenhuma decisão registrada'}
          description={mode === 'pending'
            ? 'Quando houver devoluções aguardando sua decisão, elas aparecerão aqui.'
            : 'O histórico de decisões aparecerá aqui.'}
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap">Data</th>
                <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Identificador</th>
                <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">NF</th>
                <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Itens</th>
                <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap">Fotos Caixa</th>
                <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap">Fotos Itens</th>
                {mode === 'pending' && (
                  <>
                    <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Decisão</th>
                    <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap">Tempo Restante</th>
                  </>
                )}
                {mode === 'history' && (
                  <>
                    <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Decisão</th>
                    <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap">Decidido em</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((row) => (
                <tr key={row.id} className="hover:bg-muted/30 transition-colors ease-quint">
                  <td className="px-3 py-2.5 whitespace-nowrap text-muted-foreground text-xs">
                    {formatDate(row.receivedAt)}
                  </td>
                  <td className="px-3 py-2.5">
                    <IdentifierTag row={row} />
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex flex-col items-start gap-1">
                      {row.invoiceXmlPath && (
                        <DownloadXmlButton
                          path={row.invoiceXmlPath}
                          filename={xmlDownloadName(row.rv, 'original')}
                          label="NF (XML)"
                          className="text-primary hover:underline text-xs font-medium disabled:opacity-50"
                        />
                      )}
                      {row.invoicePdfPath && (
                        <DownloadXmlButton
                          path={row.invoicePdfPath}
                          filename={danfeDownloadName(row.rv)}
                          bucket="invoice-pdfs"
                          label="NF (DANFE)"
                          className="text-primary hover:underline text-xs font-medium disabled:opacity-50"
                        />
                      )}
                      {mode === 'history' && row.returnInvoiceXmlPath && (
                        <DownloadXmlButton
                          path={row.returnInvoiceXmlPath}
                          filename={xmlDownloadName(row.rv, 'devolucao')}
                          label="Devolução"
                          className="text-primary hover:underline text-xs font-medium disabled:opacity-50"
                        />
                      )}
                      {!row.invoiceXmlPath && !row.invoicePdfPath && !(mode === 'history' && row.returnInvoiceXmlPath) && (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-center text-muted-foreground">{row.itemCount}</td>
                  <td className="px-3 py-2.5">
                    <PhotoThumbs
                      urls={row.boxPhotoUrls}
                      onOpen={(i) => setGallery({ urls: row.boxPhotoUrls, index: i, prefix: `${row.rv}-caixa` })}
                      size="sm"
                      maxVisible={3}
                      emptyText="—"
                    />
                  </td>
                  <td className="px-3 py-2.5">
                    <PhotoThumbs
                      urls={row.itemPhotoUrls}
                      onOpen={(i) => setGallery({ urls: row.itemPhotoUrls, index: i, prefix: `${row.rv}-item` })}
                      size="sm"
                      maxVisible={3}
                      emptyText="—"
                    />
                  </td>
                  {mode === 'pending' && (
                    <>
                      <td className="px-3 py-2.5">
                        <div className="flex flex-wrap gap-1">
                          {DECISION_BUTTONS.map((btn) => (
                            <button
                              key={btn.decision}
                              type="button"
                              onClick={() => setSelectedDecision({ row, decision: btn.decision })}
                              className={`px-2.5 py-1 rounded-md text-xs transition-colors ease-quint ${btn.className}`}
                            >
                              {btn.label}
                            </button>
                          ))}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <CountdownTimer receivedAt={row.receivedAt} />
                      </td>
                    </>
                  )}
                  {mode === 'history' && (
                    <>
                      <td className="px-3 py-2.5">
                        {row.decision ? (
                          <div className="flex items-center gap-1.5">
                            <DecisionPill decision={row.decision} />
                            {row.decidedByType === 'auto' && (
                              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Auto</Badge>
                            )}
                          </div>
                        ) : '—'}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap text-muted-foreground text-xs">
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
          <span className="text-sm text-muted-foreground px-2">
            {currentPage} / {totalPages}
          </span>
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
          downloadPrefix={gallery.prefix}
          onNavigate={(i) => setGallery({ ...gallery, index: i })}
          onClose={() => setGallery(null)}
        />
      )}
    </div>
  )
}
