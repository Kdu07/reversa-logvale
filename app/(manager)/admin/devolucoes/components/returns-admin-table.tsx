'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { DecisionPill } from '@/components/shared/decision-pill'
import { EmptyState } from '@/components/shared/empty-state'
import { PhotoGallery } from '@/components/shared/photo-gallery'
import { PhotoThumbs } from '@/components/shared/photo-thumbs'
import { DownloadXmlButton } from '@/components/shared/download-xml-button'
import { formatDate, identifierLabel, xmlDownloadName } from '@/lib/format'
import { ptBR } from '@/lib/i18n/pt-BR'
import { revertReturnStatusAction } from '../actions'
import { Boxes, ChevronLeft, ChevronRight, Search } from 'lucide-react'
import type { AdminReturnRow } from '../actions'
import type { ReturnStatus } from '@/types'

const t = ptBR.admin.returns

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
  rows:          AdminReturnRow[]
  total:         number
  currentRv:     string
  currentStatus: string
  currentPage:   number
}

export function ReturnsAdminTable({
  rows, total, currentRv, currentStatus, currentPage,
}: Props) {
  const router                          = useRouter()
  const [detailsRow, setDetailsRow]     = useState<AdminReturnRow | null>(null)
  const [revertTarget, setRevertTarget] = useState<AdminReturnRow | null>(null)
  const [revertError, setRevertError]   = useState<string | null>(null)
  const [gallery, setGallery]           = useState<{ urls: string[]; index: number } | null>(null)
  const [isPending, startTransition]    = useTransition()

  const totalPages = Math.max(1, Math.ceil(total / 50))

  function buildUrl(rv: string, status: string, page: number) {
    const p = new URLSearchParams()
    if (rv)     p.set('rv', rv)
    if (status) p.set('status', status)
    if (page > 1) p.set('page', String(page))
    const qs = p.toString()
    return `/admin/devolucoes${qs ? `?${qs}` : ''}`
  }

  function handleRevert() {
    if (!revertTarget) return
    setRevertError(null)
    startTransition(async () => {
      const result = await revertReturnStatusAction(revertTarget.id)
      if ('error' in result) { setRevertError(result.error); return }
      setRevertTarget(null)
      setDetailsRow(null)
    })
  }

  const statuses: Array<ReturnStatus | ''> = ['', 'awaiting_decision', 'decided', 'processed']

  return (
    <>
      {/* Filtros */}
      <div className="flex gap-3 flex-wrap items-center">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <input
            className="h-9 rounded-md border border-input bg-background pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring w-48 placeholder:text-muted-foreground"
            placeholder="Buscar por RV..."
            defaultValue={currentRv}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                router.push(buildUrl((e.target as HTMLInputElement).value, currentStatus, 1))
              }
            }}
          />
        </div>
        <select
          className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          value={currentStatus}
          onChange={(e) => router.push(buildUrl(currentRv, e.target.value, 1))}
        >
          {statuses.map((s) => (
            <option key={s} value={s}>
              {s ? STATUS_LABELS[s as ReturnStatus] : 'Todos os status'}
            </option>
          ))}
        </select>
        <Badge variant="secondary" className="ml-auto">{total} devoluções</Badge>
      </div>

      {/* Tabela */}
      {rows.length === 0 ? (
        <EmptyState icon={Boxes} title="Nenhuma devolução" description={ptBR.common.noResults} />
      ) : (
        <div className="rounded-lg border border-border overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b bg-muted/30">
                <th className="px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap">{t.colDate}</th>
                <th className="px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">{t.colRv}</th>
                <th className="px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">{t.colStatus}</th>
                <th className="px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">{t.colDecision}</th>
                <th className="px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">{t.colOperator}</th>
                <th className="px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">{t.colDepositor}</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-muted/30 transition-colors ease-quint">
                  <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap text-xs">{formatDate(r.receivedAt)}</td>
                  <td className="px-4 py-2.5 font-mono font-medium">{r.rv}</td>
                  <td className="px-4 py-2.5">
                    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${STATUS_CLASS[r.status]}`}>
                      <span className="h-1.5 w-1.5 rounded-full bg-current" />
                      {STATUS_LABELS[r.status]}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    {r.decision
                      ? <DecisionPill decision={r.decision} />
                      : <span className="text-xs text-muted-foreground">—</span>}
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground text-xs">{r.operatorName ?? '—'}</td>
                  <td className="px-4 py-2.5 text-muted-foreground text-xs">{r.depositorName ?? '—'}</td>
                  <td className="px-4 py-2.5 text-right">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setDetailsRow(r)}
                      className="h-7 text-xs"
                    >
                      {t.detailsBtn}
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
            onClick={() => router.push(buildUrl(currentRv, currentStatus, currentPage - 1))}
            className="gap-1"
          >
            <ChevronLeft className="h-4 w-4" />
            Anterior
          </Button>
          <span className="text-sm text-muted-foreground px-2">Página {currentPage} de {totalPages}</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={currentPage >= totalPages}
            onClick={() => router.push(buildUrl(currentRv, currentStatus, currentPage + 1))}
            className="gap-1"
          >
            Próxima
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Modal de detalhes */}
      <Dialog open={!!detailsRow} onOpenChange={(o) => !o && setDetailsRow(null)}>
        {detailsRow && (
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-mono text-xl">{detailsRow.rv}</DialogTitle>
              <div className="flex gap-2 flex-wrap pt-1">
                <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${STATUS_CLASS[detailsRow.status]}`}>
                  <span className="h-1.5 w-1.5 rounded-full bg-current" />
                  {STATUS_LABELS[detailsRow.status]}
                </span>
                {detailsRow.decision && <DecisionPill decision={detailsRow.decision} />}
                {detailsRow.decidedByType === 'auto' && (
                  <Badge variant="secondary" className="text-[10px] px-1.5">Auto</Badge>
                )}
              </div>
            </DialogHeader>

            <div className="space-y-5 py-2">
              <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                <InfoField label="Depositante"  value={detailsRow.depositorName ?? '—'} />
                <InfoField label="Operador"     value={detailsRow.operatorName ?? '—'} />
                <InfoField label="Recebido em"  value={formatDate(detailsRow.receivedAt)} />
                {detailsRow.decidedAt   && <InfoField label="Decisão em"    value={formatDate(detailsRow.decidedAt)} />}
                {detailsRow.processedAt && <InfoField label="Processado em" value={formatDate(detailsRow.processedAt)} />}
                <InfoField label="Itens" value={String(detailsRow.itemCount)} />
                <div className="col-span-2">
                  <p className="text-xs text-muted-foreground">Identificador</p>
                  <p className="font-mono text-xs break-all mt-0.5">{identifierLabel(detailsRow)}</p>
                </div>
              </div>

              {detailsRow.invoiceXmlPath && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">NF Original</p>
                  <DownloadXmlButton
                    path={detailsRow.invoiceXmlPath}
                    filename={xmlDownloadName(detailsRow.rv, 'original')}
                    className="text-sm text-primary hover:underline font-medium disabled:opacity-50"
                  />
                </div>
              )}
              {detailsRow.returnInvoiceXmlPath && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">NF de Devolução</p>
                  <DownloadXmlButton
                    path={detailsRow.returnInvoiceXmlPath}
                    filename={xmlDownloadName(detailsRow.rv, 'devolucao')}
                    className="text-sm text-primary hover:underline font-medium disabled:opacity-50"
                  />
                </div>
              )}
              {detailsRow.boxPhotoUrls.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Fotos da Caixa</p>
                  <PhotoThumbs urls={detailsRow.boxPhotoUrls} onOpen={(i) => setGallery({ urls: detailsRow.boxPhotoUrls, index: i })} />
                </div>
              )}
              {detailsRow.itemPhotoUrls.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Fotos dos Itens</p>
                  <PhotoThumbs urls={detailsRow.itemPhotoUrls} onOpen={(i) => setGallery({ urls: detailsRow.itemPhotoUrls, index: i })} />
                </div>
              )}
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="outline" onClick={() => setDetailsRow(null)}>
                Fechar
              </Button>
              {(detailsRow.status === 'decided' || detailsRow.status === 'processed') && (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => { setRevertError(null); setRevertTarget(detailsRow) }}
                >
                  {t.revertBtn}
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>

      {/* Confirmar reversão */}
      <Dialog open={!!revertTarget} onOpenChange={(o) => !o && setRevertTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t.revertTitle}</DialogTitle>
            <DialogDescription>{t.revertDesc}</DialogDescription>
          </DialogHeader>
          {revertError && (
            <Alert variant="destructive">
              <AlertDescription>{revertError}</AlertDescription>
            </Alert>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setRevertTarget(null)} disabled={isPending}>
              {ptBR.common.cancel}
            </Button>
            <Button type="button" variant="destructive" onClick={handleRevert} disabled={isPending}>
              {isPending ? 'Revertendo...' : 'Confirmar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {gallery && (
        <PhotoGallery
          urls={gallery.urls}
          currentIndex={gallery.index}
          onNavigate={(i) => setGallery({ ...gallery, index: i })}
          onClose={() => setGallery(null)}
        />
      )}
    </>
  )
}

function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium text-foreground mt-0.5">{value}</p>
    </div>
  )
}
