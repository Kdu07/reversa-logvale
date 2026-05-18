'use client'

import { useReducer, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ProgressBar } from './progress-bar'
import { StepIdentifier } from './steps/step-identifier'
import { StepRv } from './steps/step-rv'
import { StepItemCount } from './steps/step-item-count'
import { StepPhotos } from './steps/step-photos'
import { StepReview } from './steps/step-review'
import { StepSubmit } from './steps/step-submit'
import type { InvoiceData } from './actions'
import type { IdentifierType } from '@/types'

export interface ReceivingState {
  step:           number
  identifierType: IdentifierType | null
  accessKey:      string | null
  postalCode:     string | null
  illegibleToken: string | null
  invoiceData:    InvoiceData | null
  rv:             string
  itemCount:      number | null
  boxPhotos:      File[]
  itemPhotos:     File[]
}

type ReceivingAction =
  | { type: 'SET_STEP'; step: number }
  | { type: 'SET_IDENTIFIER'; identifierType: IdentifierType; accessKey?: string; postalCode?: string; illegibleToken?: string }
  | { type: 'SET_INVOICE_DATA'; data: InvoiceData | null }
  | { type: 'SET_RV'; rv: string }
  | { type: 'SET_ITEM_COUNT'; count: number }
  | { type: 'ADD_BOX_PHOTO'; file: File }
  | { type: 'REMOVE_BOX_PHOTO'; index: number }
  | { type: 'ADD_ITEM_PHOTO'; file: File }
  | { type: 'REMOVE_ITEM_PHOTO'; index: number }
  | { type: 'RESET' }

const initialState: ReceivingState = {
  step:           1,
  identifierType: null,
  accessKey:      null,
  postalCode:     null,
  illegibleToken: null,
  invoiceData:    null,
  rv:             '',
  itemCount:      null,
  boxPhotos:      [],
  itemPhotos:     [],
}

function reducer(state: ReceivingState, action: ReceivingAction): ReceivingState {
  switch (action.type) {
    case 'SET_STEP':
      return { ...state, step: action.step }
    case 'SET_IDENTIFIER':
      return {
        ...state,
        identifierType: action.identifierType,
        accessKey:      action.accessKey      ?? null,
        postalCode:     action.postalCode     ?? null,
        illegibleToken: action.illegibleToken ?? null,
      }
    case 'SET_INVOICE_DATA':
      return { ...state, invoiceData: action.data }
    case 'SET_RV':
      return { ...state, rv: action.rv }
    case 'SET_ITEM_COUNT':
      return { ...state, itemCount: action.count }
    case 'ADD_BOX_PHOTO':
      return { ...state, boxPhotos: [...state.boxPhotos, action.file] }
    case 'REMOVE_BOX_PHOTO':
      return { ...state, boxPhotos: state.boxPhotos.filter((_, i) => i !== action.index) }
    case 'ADD_ITEM_PHOTO':
      return { ...state, itemPhotos: [...state.itemPhotos, action.file] }
    case 'REMOVE_ITEM_PHOTO':
      return { ...state, itemPhotos: state.itemPhotos.filter((_, i) => i !== action.index) }
    case 'RESET':
      return initialState
    default:
      return state
  }
}

interface ReceivingFlowProps {
  operatorName: string
}

export function ReceivingFlow({ operatorName }: ReceivingFlowProps) {
  const [state, dispatch]          = useReducer(reducer, initialState)
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)
  const router = useRouter()

  function goTo(step: number) { dispatch({ type: 'SET_STEP', step }) }

  const stepContent = (() => {
    switch (state.step) {
      case 1:
        return (
          <StepIdentifier
            onComplete={({ identifierType, accessKey, postalCode, illegibleToken, invoiceData }) => {
              dispatch({ type: 'SET_IDENTIFIER', identifierType, accessKey, postalCode, illegibleToken })
              if (invoiceData) dispatch({ type: 'SET_INVOICE_DATA', data: invoiceData })
              goTo(2)
            }}
          />
        )
      case 2:
        return (
          <StepRv
            rv={state.rv}
            onComplete={(rv) => { dispatch({ type: 'SET_RV', rv }); goTo(3) }}
            onBack={() => goTo(1)}
          />
        )
      case 3:
        return (
          <StepItemCount
            itemCount={state.itemCount}
            onComplete={(count) => { dispatch({ type: 'SET_ITEM_COUNT', count }); goTo(4) }}
            onBack={() => goTo(2)}
          />
        )
      case 4:
        return (
          <StepPhotos
            photoType="box"
            stepNumber={4}
            label="Fotos da Caixa"
            minPhotos={2}
            maxPhotos={4}
            photos={state.boxPhotos}
            onAdd={(f) => dispatch({ type: 'ADD_BOX_PHOTO', file: f })}
            onRemove={(i) => dispatch({ type: 'REMOVE_BOX_PHOTO', index: i })}
            onNext={() => goTo(5)}
            onBack={() => goTo(3)}
          />
        )
      case 5:
        return (
          <StepPhotos
            photoType="item"
            stepNumber={5}
            label="Fotos dos Itens"
            minPhotos={1}
            maxPhotos={5}
            photos={state.itemPhotos}
            onAdd={(f) => dispatch({ type: 'ADD_ITEM_PHOTO', file: f })}
            onRemove={(i) => dispatch({ type: 'REMOVE_ITEM_PHOTO', index: i })}
            onNext={() => goTo(6)}
            onBack={() => goTo(4)}
          />
        )
      case 6:
        return (
          <StepReview
            state={state}
            onConfirm={() => goTo(7)}
            onGoTo={goTo}
            onBack={() => goTo(5)}
          />
        )
      case 7:
        return (
          <StepSubmit
            state={state}
            onBack={() => goTo(6)}
            onReset={() => dispatch({ type: 'RESET' })}
          />
        )
      default:
        return null
    }
  })()

  return (
    <div className="max-w-xl mx-auto space-y-6">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-primary">Novo Recebimento</h1>
          <p className="text-xs text-muted-foreground">{operatorName}</p>
        </div>
        {state.step < 7 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-destructive"
            onClick={() => setShowCancelConfirm(true)}
          >
            Cancelar
          </Button>
        )}
      </div>

      <ProgressBar step={state.step} />

      <div className="rounded-xl border bg-card p-6">
        {stepContent}
      </div>

      {/* Cancel confirmation overlay */}
      {showCancelConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full space-y-4 shadow-xl">
            <p className="font-semibold text-foreground">Cancelar recebimento?</p>
            <p className="text-sm text-muted-foreground">
              Todos os dados inseridos serão descartados.
            </p>
            <div className="flex gap-3">
              <Button
                type="button" variant="ghost"
                className="flex-1"
                onClick={() => setShowCancelConfirm(false)}
              >
                Continuar
              </Button>
              <Button
                type="button"
                className="flex-1 bg-accent hover:bg-accent/90 text-accent-foreground"
                onClick={() => {
                  dispatch({ type: 'RESET' })
                  setShowCancelConfirm(false)
                  router.push('/operador')
                }}
              >
                Descartar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
