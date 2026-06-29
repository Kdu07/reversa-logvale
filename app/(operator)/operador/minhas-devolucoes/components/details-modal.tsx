'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { DecisionPill } from '@/components/shared/decision-pill'
import { PhotoGallery } from '@/components/shared/photo-gallery'
import { PhotoThumbs } from '@/components/shared/photo-thumbs'
import { DownloadXmlButton } from '@/components/shared/download-xml-button'
import { formatDate, identifierLabel, xmlDownloadName, danfeDownloadName } from '@/lib/format'
import { ptBR } from '@/lib/i18n/pt-BR'
import type { ReturnStatus } from '@/types'
import type { MyReturnRow } from '../actions'

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
  row:     MyReturnRow
  onClose: () => void
}

export function DetailsModal({ row, onClose }: Props) {
  const [gallery, setGallery] = useState<{ urls: string[]; index: number; prefix?: string } | null>(null)

  return (
    <>
      <Dialog open onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-mono text-xl">{row.rv}</DialogTitle>
            <div className="flex gap-2 flex-wrap pt-1">
              <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${STATUS_CLASS[row.status]}`}>
                <span className="h-1.5 w-1.5 rounded-full bg-current" />
                {STATUS_LABELS[row.status]}
              </span>
              {row.decision && <DecisionPill decision={row.decision} />}
              {row.decidedByType === 'auto' && (
                <Badge variant="secondary" className="text-[10px] px-1.5">Auto</Badge>
              )}
            </div>
          </DialogHeader>

          <div className="space-y-5 py-2">
            <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <InfoField label="Depositante" value={row.depositorName ?? '—'} />
              <InfoField label="Nº de Itens" value={String(row.itemCount)} />
              <div className="col-span-2">
                <InfoField label="Cliente final" value={row.finalCustomerName ?? '—'} />
              </div>
              <InfoField label="Recebido em" value={formatDate(row.receivedAt)} />
              {row.decidedAt   && <InfoField label="Decisão em"    value={formatDate(row.decidedAt)} />}
              {row.processedAt && <InfoField label="Processado em" value={formatDate(row.processedAt)} />}
              <div className="col-span-2">
                <p className="text-xs text-muted-foreground">Identificador</p>
                <p className="font-mono text-xs break-all mt-0.5">{identifierLabel(row)}</p>
              </div>
            </div>

            {(row.invoiceXmlPath || row.invoicePdfPath) && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">NF Original</p>
                <div className="flex gap-4">
                  {row.invoiceXmlPath && (
                    <DownloadXmlButton
                      path={row.invoiceXmlPath}
                      filename={xmlDownloadName(row.rv, 'original')}
                      className="text-sm text-primary hover:underline font-medium disabled:opacity-50"
                    />
                  )}
                  {row.invoicePdfPath && (
                    <DownloadXmlButton
                      path={row.invoicePdfPath}
                      filename={danfeDownloadName(row.rv)}
                      bucket="invoice-pdfs"
                      label="Baixar DANFE (PDF)"
                      className="text-sm text-primary hover:underline font-medium disabled:opacity-50"
                    />
                  )}
                </div>
              </div>
            )}
            {row.returnInvoiceXmlPath && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">NF de Devolução</p>
                <DownloadXmlButton
                  path={row.returnInvoiceXmlPath}
                  filename={xmlDownloadName(row.rv, 'devolucao')}
                  className="text-sm text-primary hover:underline font-medium disabled:opacity-50"
                />
              </div>
            )}

            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Fotos da Caixa</p>
              <PhotoThumbs
                urls={row.boxPhotoUrls}
                onOpen={(i) => setGallery({ urls: row.boxPhotoUrls, index: i, prefix: `${row.rv}-caixa` })}
                emptyText="Nenhuma foto"
              />
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Fotos dos Itens</p>
              <PhotoThumbs
                urls={row.itemPhotoUrls}
                onOpen={(i) => setGallery({ urls: row.itemPhotoUrls, index: i, prefix: `${row.rv}-item` })}
                emptyText="Nenhuma foto"
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {gallery && (
        <PhotoGallery
          urls={gallery.urls}
          currentIndex={gallery.index}
          downloadPrefix={gallery.prefix}
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
