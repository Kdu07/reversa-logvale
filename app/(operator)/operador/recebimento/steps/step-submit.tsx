'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { createReturnAction } from '../actions'
import type { ReceivingState } from '../receiving-flow'

interface StepSubmitProps {
  state:  ReceivingState
  onBack: () => void
  onReset: () => void
}

type Phase = 'uploading' | 'saving' | 'success' | 'error'

export function StepSubmit({ state, onBack, onReset }: StepSubmitProps) {
  const [phase, setPhase]   = useState<Phase | null>(null)
  const [error, setError]   = useState<string | null>(null)
  const router = useRouter()

  async function handleConfirm() {
    setError(null)
    setPhase('uploading')

    try {
      const supabase  = createClient()
      const folderUid = crypto.randomUUID()

      const uploadPhoto = async (file: File, bucket: string, index: number): Promise<string> => {
        const path = `${folderUid}/${Date.now()}-${index}.jpg`
        const { error: uploadError } = await supabase.storage
          .from(bucket)
          .upload(path, file, { contentType: 'image/jpeg' })
        if (uploadError) throw new Error(`Upload falhou: ${uploadError.message}`)
        return path
      }

      const boxPaths: string[]  = []
      const itemPaths: string[] = []

      for (let i = 0; i < state.boxPhotos.length; i++) {
        boxPaths.push(await uploadPhoto(state.boxPhotos[i], 'box-photos', i))
      }
      for (let i = 0; i < state.itemPhotos.length; i++) {
        itemPaths.push(await uploadPhoto(state.itemPhotos[i], 'item-photos', i))
      }

      setPhase('saving')

      const result = await createReturnAction({
        identifierType:  state.identifierType!,
        accessKey:       state.accessKey,
        postalCode:      state.postalCode,
        illegibleToken:  state.illegibleToken,
        rv:              state.rv,
        itemCount:       state.itemCount!,
        depositorId:     state.invoiceData?.depositorId ?? null,
        invoiceXmlPath:  state.invoiceData?.xmlStoragePath ?? null,
        boxPhotosPaths:  boxPaths,
        itemPhotosPaths: itemPaths,
      })

      if ('error' in result) {
        setError(result.error)
        setPhase('error')
        return
      }

      setPhase('success')
      setTimeout(() => {
        onReset()
        router.replace('/operador/recebimento')
        router.refresh()
      }, 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
      setPhase('error')
    }
  }

  if (phase === 'success') {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-4 text-center">
        <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center text-3xl animate-bounce">
          ✓
        </div>
        <p className="text-xl font-semibold text-green-700">Recebimento registrado!</p>
        <p className="text-sm text-muted-foreground">Redirecionando...</p>
      </div>
    )
  }

  const isLoading = phase === 'uploading' || phase === 'saving'

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-primary">Etapa 7 — Registrar Recebimento</h2>
        <p className="text-sm text-muted-foreground">
          As fotos serão enviadas e o recebimento registrado no sistema.
        </p>
      </div>

      {phase === 'uploading' && (
        <div className="text-sm text-muted-foreground animate-pulse">
          Enviando fotos ({state.boxPhotos.length + state.itemPhotos.length} arquivos)...
        </div>
      )}

      {phase === 'saving' && (
        <div className="text-sm text-muted-foreground animate-pulse">
          Registrando no sistema...
        </div>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex gap-3">
        <Button
          type="button" variant="outline"
          onClick={onBack}
          disabled={isLoading}
          className="flex-1"
        >
          Voltar
        </Button>
        <Button
          type="button"
          onClick={handleConfirm}
          disabled={isLoading}
          className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground"
        >
          {isLoading ? 'Aguarde...' : 'Registrar Recebimento'}
        </Button>
      </div>
    </div>
  )
}
