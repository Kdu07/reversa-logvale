'use client'

import { useRef, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { useBarcodeScanner } from '@/hooks/use-barcode-scanner'
import { useAudioFeedback } from '@/hooks/use-audio-feedback'

interface StepRvProps {
  rv:         string
  onComplete: (rv: string) => void
  onBack:     () => void
}

export function StepRv({ rv: initialRv, onComplete, onBack }: StepRvProps) {
  const [mode, setMode]   = useState<'scanner' | 'manual'>('scanner')
  const [value, setValue] = useState(initialRv)
  const [flash, setFlash] = useState<'success' | 'error' | null>(null)

  const inputRef = useRef<HTMLInputElement>(null)
  const { beep }  = useAudioFeedback()

  useEffect(() => {
    if (mode === 'manual') {
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [mode])

  function complete(rv: string) {
    const v = rv.trim()
    if (!v) return
    setValue(v)
    setFlash('success')
    beep('success')
    setTimeout(() => { setFlash(null); onComplete(v) }, 300)
  }

  useBarcodeScanner({
    onScan:    (scanned) => complete(scanned),
    minLength: 8,
    enabled:   mode === 'scanner',
  })

  return (
    <div className={cn(
      'space-y-6 rounded-xl p-1 transition-colors duration-500',
      flash === 'success' && 'bg-green-50',
      flash === 'error'   && 'bg-red-50',
    )}>
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-primary">Etapa 2 — RV</h2>
        <p className="text-sm text-muted-foreground">
          {mode === 'scanner'
            ? 'Bipe o código de barras (EAN) do RV colado na caixa.'
            : 'Digite o código RV manualmente.'}
        </p>
      </div>

      {mode === 'manual' && (
        <div className="space-y-2">
          <Label htmlFor="rv">Código RV</Label>
          <Input
            id="rv"
            ref={inputRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="RV-00000"
            onKeyDown={(e) => e.key === 'Enter' && complete(value)}
          />
        </div>
      )}

      <div className="border-t pt-3">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="w-full justify-start text-muted-foreground"
          onClick={() => setMode(mode === 'scanner' ? 'manual' : 'scanner')}
        >
          {mode === 'scanner' ? 'Não consigo bipar — digitar à mão' : 'Usar leitor de barras'}
        </Button>
      </div>

      {mode === 'scanner' && (
        <div className="text-center text-4xl text-primary/20 py-4 select-none">
          ▋ aguardando leitura do RV...
        </div>
      )}

      <div className="flex gap-3">
        <Button type="button" variant="outline" onClick={onBack} className="flex-1">
          Voltar
        </Button>
        {mode === 'manual' && (
          <Button
            type="button"
            onClick={() => complete(value)}
            disabled={!value.trim()}
            className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            Próximo
          </Button>
        )}
      </div>
    </div>
  )
}
