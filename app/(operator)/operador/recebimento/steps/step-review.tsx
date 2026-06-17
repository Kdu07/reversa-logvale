'use client'

import { useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { DownloadXmlButton } from '@/components/shared/download-xml-button'
import { xmlDownloadName } from '@/lib/format'
import type { ReceivingState } from '../receiving-flow'

interface StepReviewProps {
  state:     ReceivingState
  onConfirm: () => void
  onGoTo:    (step: number) => void
  onBack:    () => void
}

export function StepReview({ state, onConfirm, onGoTo, onBack }: StepReviewProps) {
  const boxUrls  = useRef<string[]>([])
  const itemUrls = useRef<string[]>([])

  useEffect(() => {
    boxUrls.current  = state.boxPhotos.map((f) => URL.createObjectURL(f))
    itemUrls.current = state.itemPhotos.map((f) => URL.createObjectURL(f))
    return () => {
      boxUrls.current.forEach((u) => URL.revokeObjectURL(u))
      itemUrls.current.forEach((u) => URL.revokeObjectURL(u))
    }
  }, [state.boxPhotos, state.itemPhotos])

  const identifierLabel =
    state.identifierType === 'access_key'  ? `Chave: ${state.accessKey}` :
    state.identifierType === 'postal_code' ? `CEP: ${state.postalCode}`  :
    `Ilegível: ${state.illegibleToken}`

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-primary">Etapa 6 — Revisão</h2>
        <p className="text-sm text-muted-foreground">Confirme todos os dados antes de registrar.</p>
      </div>

      <ReviewSection label="Identificador" onEdit={() => onGoTo(1)}>
        <p className="text-sm font-mono break-all">{identifierLabel}</p>
        {state.invoiceData && (
          <p className="text-xs text-muted-foreground mt-1">
            CNPJ: {state.invoiceData.emitterCnpj}
            {state.invoiceData.invoiceNumber && ` · NF ${state.invoiceData.invoiceNumber}`}
          </p>
        )}
        {state.depositorName ? (
          <p className="text-xs text-green-700 mt-0.5">Depositante: {state.depositorName}</p>
        ) : state.depositorId ? (
          <p className="text-xs text-blue-700 mt-0.5">Depositante vinculado</p>
        ) : state.identifierType === 'access_key' ? (
          <p className="text-xs text-amber-600 mt-0.5">Depositante não cadastrado</p>
        ) : null}
        {state.invoiceData?.xmlStoragePath && (
          <DownloadXmlButton
            path={state.invoiceData.xmlStoragePath}
            filename={xmlDownloadName(state.rv, 'original')}
            label="Baixar XML da NF"
            loadingLabel="Gerando link…"
            className="mt-1 text-xs text-primary hover:underline disabled:opacity-50"
          />
        )}
      </ReviewSection>

      <ReviewSection label="RV" onEdit={() => onGoTo(2)}>
        <p className="text-sm font-mono">{state.rv}</p>
      </ReviewSection>

      <ReviewSection label="Nº de Itens" onEdit={() => onGoTo(3)}>
        <p className="text-sm">{state.itemCount}</p>
      </ReviewSection>

      <ReviewSection label={`Fotos da Caixa (${state.boxPhotos.length})`} onEdit={() => onGoTo(4)}>
        <PhotoGrid urls={boxUrls.current} />
      </ReviewSection>

      <ReviewSection label={`Fotos dos Itens (${state.itemPhotos.length})`} onEdit={() => onGoTo(5)}>
        <PhotoGrid urls={itemUrls.current} />
      </ReviewSection>

      <div className="flex gap-3 pt-2">
        <Button type="button" variant="outline" onClick={onBack} className="flex-1">
          Voltar
        </Button>
        <Button
          type="button"
          onClick={onConfirm}
          className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground"
        >
          Confirmar e Registrar
        </Button>
      </div>
    </div>
  )
}

function ReviewSection({
  label, onEdit, children,
}: { label: string; onEdit: () => void; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border rounded-lg p-3">
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-muted-foreground mb-1">{label}</p>
        {children}
      </div>
      <Button type="button" variant="ghost" size="sm" onClick={onEdit} className="shrink-0 text-xs">
        Editar
      </Button>
    </div>
  )
}

function PhotoGrid({ urls }: { urls: string[] }) {
  return (
    <div className="flex gap-1 flex-wrap">
      {urls.map((url, i) => (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img key={i} src={url} alt={`foto ${i + 1}`} className="w-16 h-16 object-cover rounded" loading="lazy" />
      ))}
    </div>
  )
}
