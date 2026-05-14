'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { PhotoGallery } from '@/components/shared/photo-gallery'
import { ptBR } from '@/lib/i18n/pt-BR'
import { revertReturnStatusAction } from '../actions'
import type { AdminReturnRow } from '../actions'
import type { ReturnStatus, ReturnDecision } from '@/types'

const t = ptBR.admin.returns

const STATUS_LABELS: Record<ReturnStatus, string> = {
  awaiting_decision: ptBR.returnStatus.awaiting_decision,
  decided:           ptBR.returnStatus.decided,
  processed:         ptBR.returnStatus.processed,
}

const STATUS_BADGE: Record<ReturnStatus, string> = {
  awaiting_decision: 'bg-amber-100 text-amber-800 border-amber-300',
  decided:           'bg-blue-100  text-blue-800  border-blue-300',
  processed:         'bg-green-100 text-green-800 border-green-300',
}

const DECISION_LABELS: Record<ReturnDecision, string> = {
  return_to_stock:    ptBR.decisions.return_to_stock,
  store_for_handling: ptBR.decisions.store_for_handling,
  discard:            ptBR.decisions.discard,
  repackage:          ptBR.decisions.repackage,
}

const DECISION_BADGE: Record<ReturnDecision, string> = {
  return_to_stock:    'bg-green-100 text-green-800 border-green-300',
  store_for_handling: 'bg-amber-100 text-amber-800 border-amber-300',
  discard:            'bg-red-100   text-red-800   border-red-300',
  repackage:          'bg-blue-100  text-blue-800  border-blue-300',
}

interface Props {
  rows:          AdminReturnRow[]
  total:         number
  currentRv:     string
  currentStatus: string
  currentPage:   number
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function identifierLabel(row: AdminReturnRow) {
  if (row.identifierType === 'access_key')  return `Chave: ${row.accessKey}`
  if (row.identifierType === 'postal_code') return `CEP: ${row.postalCode}`
  return `Ilegível: ${row.illegibleToken}`
}

export function ReturnsAdminTable({
  rows, total, currentRv, currentStatus, currentPage,
}: Props) {
  const router                            = useRouter()
  const [detailsRow, setDetailsRow]       = useState<AdminReturnRow | null>(null)
  const [revertTarget, setRevertTarget]   = useState<AdminReturnRow | null>(null)
  const [revertError, setRevertError]     = useState<string | null>(null)
  const [gallery, setGallery]             = useState<{ urls: string[]; index: number } | null>(null)
  const [isPending, startTransition]      = useTransition()

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
      <div className="flex items-center justify-between gap-3 mb-4">
        <h1 className="text-2xl font-bold text-primary">{t.title}</h1>
        <span className="text-sm text-muted-foreground">{total} devoluções</span>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4 flex-wrap">
        <input
          className="rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary w-48"
          placeholder="Buscar por RV..."
          defaultValue={currentRv}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              router.push(buildUrl((e.target as HTMLInputElement).value, currentStatus, 1))
            }
          }}
        />
        <select
          className="rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          value={currentStatus}
          onChange={(e) => router.push(buildUrl(currentRv, e.target.value, 1))}
        >
          {statuses.map((s) => (
            <option key={s} value={s}>
              {s ? STATUS_LABELS[s as ReturnStatus] : 'Todos os status'}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-muted-foreground border-b bg-muted/30">
              <th className="px-4 py-3 font-medium">{t.colDate}</th>
              <th className="px-4 py-3 font-medium">{t.colRv}</th>
              <th className="px-4 py-3 font-medium">{t.colStatus}</th>
              <th className="px-4 py-3 font-medium">{t.colDecision}</th>
              <th className="px-4 py-3 font-medium">{t.colOperator}</th>
              <th className="px-4 py-3 font-medium">{t.colDepositor}</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                  {ptBR.common.noResults}
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-muted/20 transition-colors">
                <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{formatDate(r.receivedAt)}</td>
                <td className="px-4 py-3 font-mono font-medium">{r.rv}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_BADGE[r.status]}`}>
                    {STATUS_LABELS[r.status]}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {r.decision ? (
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${DECISION_BADGE[r.decision]}`}>
                      {DECISION_LABELS[r.decision]}
                    </span>
                  ) : <span className="text-xs text-muted-foreground">—</span>}
                </td>
                <td className="px-4 py-3 text-muted-foreground">{r.operatorName ?? '—'}</td>
                <td className="px-4 py-3 text-muted-foreground">{r.depositorName ?? '—'}</td>
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    onClick={() => setDetailsRow(r)}
                    className="text-xs text-primary hover:underline"
                  >
                    {t.detailsBtn}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between gap-2 mt-4 text-sm">
          <button
            type="button"
            disabled={currentPage <= 1}
            onClick={() => router.push(buildUrl(currentRv, currentStatus, currentPage - 1))}
            className="px-3 py-1.5 rounded border text-muted-foreground hover:bg-muted disabled:opacity-40"
          >
            ← Anterior
          </button>
          <span className="text-muted-foreground">
            Página {currentPage} de {totalPages}
          </span>
          <button
            type="button"
            disabled={currentPage >= totalPages}
            onClick={() => router.push(buildUrl(currentRv, currentStatus, currentPage + 1))}
            className="px-3 py-1.5 rounded border text-muted-foreground hover:bg-muted disabled:opacity-40"
          >
            Próxima →
          </button>
        </div>
      )}

      {/* Details modal */}
      {detailsRow && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
            <div className="flex items-start justify-between gap-3 p-5 border-b">
              <div className="space-y-1.5">
                <p className="text-xs text-muted-foreground">RV</p>
                <p className="text-xl font-bold font-mono text-foreground">{detailsRow.rv}</p>
                <div className="flex gap-2 flex-wrap">
                  <span className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_BADGE[detailsRow.status]}`}>
                    {STATUS_LABELS[detailsRow.status]}
                  </span>
                  {detailsRow.decision && (
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${DECISION_BADGE[detailsRow.decision]}`}>
                      {DECISION_LABELS[detailsRow.decision]}
                    </span>
                  )}
                  {detailsRow.decidedByType === 'auto' && (
                    <span className="text-xs px-2 py-0.5 rounded-full border border-slate-300 bg-slate-100 text-slate-600">
                      Auto
                    </span>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDetailsRow(null)}
                className="text-muted-foreground hover:text-foreground text-lg leading-none mt-1 shrink-0"
              >✕</button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <InfoField label="Depositante"  value={detailsRow.depositorName ?? '—'} />
                <InfoField label="Operador"     value={detailsRow.operatorName ?? '—'} />
                <InfoField label="Recebido em"  value={formatDate(detailsRow.receivedAt)} />
                {detailsRow.decidedAt && <InfoField label="Decisão em" value={formatDate(detailsRow.decidedAt)} />}
                {detailsRow.processedAt && <InfoField label="Processado em" value={formatDate(detailsRow.processedAt)} />}
                <InfoField label="Itens"        value={String(detailsRow.itemCount)} />
                <div className="col-span-2">
                  <p className="text-xs text-muted-foreground">Identificador</p>
                  <p className="font-mono text-xs break-all">{identifierLabel(detailsRow)}</p>
                </div>
              </div>

              {detailsRow.invoiceXmlUrl && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">NF Original</p>
                  <a href={detailsRow.invoiceXmlUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline">
                    Baixar XML
                  </a>
                </div>
              )}

              {detailsRow.returnInvoiceXmlUrl && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">NF de Devolução</p>
                  <a href={detailsRow.returnInvoiceXmlUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline">
                    Baixar XML
                  </a>
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

            <div className="flex gap-3 p-5 border-t">
              <Button type="button" variant="outline" onClick={() => setDetailsRow(null)} className="flex-1">
                Fechar
              </Button>
              {(detailsRow.status === 'decided' || detailsRow.status === 'processed') && (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => { setRevertError(null); setRevertTarget(detailsRow) }}
                  className="flex-1"
                >
                  {t.revertBtn}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Revert confirm */}
      {revertTarget && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] px-4">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full space-y-4 shadow-xl">
            <p className="font-semibold text-foreground">{t.revertTitle}</p>
            <p className="text-sm text-muted-foreground">{t.revertDesc}</p>
            {revertError && (
              <Alert variant="destructive">
                <AlertDescription>{revertError}</AlertDescription>
              </Alert>
            )}
            <div className="flex gap-3">
              <Button
                type="button"
                variant="ghost"
                className="flex-1"
                onClick={() => setRevertTarget(null)}
                disabled={isPending}
              >
                {ptBR.common.cancel}
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={handleRevert}
                disabled={isPending}
                className="flex-1"
              >
                {isPending ? 'Revertendo...' : 'Confirmar'}
              </Button>
            </div>
          </div>
        </div>
      )}

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
      <p className="font-medium text-foreground">{value}</p>
    </div>
  )
}

function PhotoThumbs({ urls, onOpen }: { urls: string[]; onOpen: (i: number) => void }) {
  return (
    <div className="flex gap-1 flex-wrap">
      {urls.map((url, i) => (
        <button
          key={i}
          type="button"
          onClick={() => onOpen(i)}
          className="w-14 h-14 rounded overflow-hidden border hover:ring-2 hover:ring-primary focus:outline-none"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt={`foto ${i + 1}`} className="w-full h-full object-cover" />
        </button>
      ))}
    </div>
  )
}
