'use client'

import { useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { itemConditionLabel } from '@/lib/format'
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
    state.identifierType === 'access_key'     ? `Chave: ${state.accessKey}` :
    state.identifierType === 'postal_code'    ? `CEP: ${state.postalCode}`  :
    state.identifierType === 'logistics_code' ? `Código de Logística Reversa: ${state.logisticsCode}` :
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
        {state.invoiceData?.finalCustomerName && (
          <p className="text-xs text-muted-foreground mt-0.5">Cliente final: {state.invoiceData.finalCustomerName}</p>
        )}
      </ReviewSection>

      <ReviewSection label="RV" onEdit={() => onGoTo(2)}>
        <p className="text-sm font-mono">{state.rv}</p>
      </ReviewSection>

      <ReviewSection label="Itens" onEdit={() => onGoTo(3)}>
        <p className="text-sm">
          {state.itemCount === 0 ? (
            <span className="font-medium text-slate-700">Caixa vazia</span>
          ) : (
            <>{state.itemCount} {state.itemCount === 1 ? 'item' : 'itens'}</>
          )}
          {state.itemCount !== null && state.itemCount > 0 && state.damagedItemCount !== null && (
            <span
              className={state.damagedItemCount > 0 ? 'text-amber-700 font-medium' : 'text-green-700 font-medium'}
            >
              {' · '}{itemConditionLabel(state.itemCount, state.damagedItemCount)}
            </span>
          )}
        </p>
      </ReviewSection>

      <ReviewSection label={`Fotos da Caixa (${state.boxPhotos.length})`} onEdit={() => onGoTo(4)}>
        <PhotoGrid urls={boxUrls.current} />
      </ReviewSection>

      {state.itemCount !== 0 && (
        <ReviewSection label={`Fotos dos Itens (${state.itemPhotos.length})`} onEdit={() => onGoTo(5)}>
          <PhotoGrid urls={itemUrls.current} />
        </ReviewSection>
      )}

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
