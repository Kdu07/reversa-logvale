'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { PhotoGallery } from '@/components/shared/photo-gallery'
import { processReturnAction } from '../actions'
import type { TrativaRow } from '../actions'
import type { ReturnDecision } from '@/types'

interface DetailsModalProps {
  row:        TrativaRow
  onClose:    () => void
  onComplete: () => void
}

const DECISION_META: Record<ReturnDecision, { label: string; badge: string }> = {
  return_to_stock:    { label: 'Voltar pro Estoque',      badge: 'bg-green-100 text-green-800 border-green-300' },
  store_for_handling: { label: 'Armazenar p/ Tratativas', badge: 'bg-amber-100 text-amber-800 border-amber-300' },
  discard:            { label: 'Descarte',                badge: 'bg-red-100   text-red-800   border-red-300'   },
  repackage:          { label: 'Reembalagem',             badge: 'bg-blue-100  text-blue-800  border-blue-300'  },
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function identifierLabel(row: TrativaRow) {
  if (row.identifierType === 'access_key')  return `Chave: ${row.accessKey}`
  if (row.identifierType === 'postal_code') return `CEP: ${row.postalCode}`
  return `Ilegível: ${row.illegibleToken}`
}

function PhotoThumbs({ urls, onOpen }: { urls: string[]; onOpen: (i: number) => void }) {
  if (urls.length === 0) return <span className="text-xs text-muted-foreground">Nenhuma foto</span>
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

export function DetailsModal({ row, onClose, onComplete }: DetailsModalProps) {
  const [showConfirm, setShowConfirm]   = useState(false)
  const [isProcessing, setProcessing]   = useState(false)
  const [error, setError]               = useState<string | null>(null)
  const [gallery, setGallery]           = useState<{ urls: string[]; index: number } | null>(null)

  const meta = DECISION_META[row.decision]

  async function handleComplete() {
    setError(null)
    setProcessing(true)
    const result = await processReturnAction(row.id)
    if ('error' in result) {
      setError(result.error)
      setProcessing(false)
      return
    }
    onComplete()
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
        <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
          {/* Header */}
          <div className="flex items-start justify-between gap-3 p-5 border-b">
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground">RV</p>
              <p className="text-xl font-bold font-mono text-foreground">{row.rv}</p>
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full border text-xs font-medium ${meta.badge}`}>
                  {meta.label}
                </span>
                {row.decidedByType === 'auto' && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full border border-slate-300 bg-slate-100 text-slate-600 text-xs font-medium">
                    Auto
                  </span>
                )}
              </div>
            </div>
            <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground text-lg leading-none shrink-0 mt-1">✕</button>
          </div>

          {/* Body — scrollável */}
          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            {/* Informações */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Informações</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Depositante</p>
                  <p className="font-medium">{row.depositorName ?? '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Cliente</p>
                  <p className="font-medium">{row.clientName ?? (row.decidedByType === 'auto' ? 'Auto' : '—')}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Recebido em</p>
                  <p className="font-medium">{formatDate(row.receivedAt)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Decisão em</p>
                  <p className="font-medium">{formatDate(row.decidedAt)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Nº de Itens</p>
                  <p className="font-medium">{row.itemCount}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Identificador</p>
                  <p className="font-mono text-xs break-all">{identifierLabel(row)}</p>
                </div>
              </div>
            </div>

            {/* NF */}
            {row.invoiceXmlUrl && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Nota Fiscal</p>
                <a
                  href={row.invoiceXmlUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline"
                >
                  Baixar XML da NF
                </a>
              </div>
            )}

            {/* Fotos da Caixa */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Fotos da Caixa</p>
              <PhotoThumbs
                urls={row.boxPhotoUrls}
                onOpen={(i) => setGallery({ urls: row.boxPhotoUrls, index: i })}
              />
            </div>

            {/* Fotos dos Itens */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Fotos dos Itens</p>
              <PhotoThumbs
                urls={row.itemPhotoUrls}
                onOpen={(i) => setGallery({ urls: row.itemPhotoUrls, index: i })}
              />
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </div>

          {/* Footer */}
          <div className="flex gap-3 p-5 border-t">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              Fechar
            </Button>
            <Button
              type="button"
              onClick={() => setShowConfirm(true)}
              className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              Concluir
            </Button>
          </div>
        </div>
      </div>

      {/* Confirm overlay */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] px-4">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full space-y-4 shadow-xl">
            <p className="font-semibold text-foreground">Confirmar conclusão?</p>
            <p className="text-sm text-muted-foreground">
              A tratativa será marcada como concluída e removida desta lista.
            </p>
            <div className="flex gap-3">
              <Button
                type="button"
                variant="ghost"
                className="flex-1"
                onClick={() => setShowConfirm(false)}
                disabled={isProcessing}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={handleComplete}
                disabled={isProcessing}
                className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                {isProcessing ? 'Concluindo...' : 'Confirmar'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Photo gallery */}
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
