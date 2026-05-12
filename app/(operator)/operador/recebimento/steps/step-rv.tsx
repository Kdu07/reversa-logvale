'use client'

import { useRef, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { useBarcodeScanner } from '@/hooks/use-barcode-scanner'
import { useAudioFeedback } from '@/hooks/use-audio-feedback'

interface StepRvProps {
  rv:          string
  onComplete:  (rv: string) => void
  onBack:      () => void
}

export function StepRv({ rv: initialRv, onComplete, onBack }: StepRvProps) {
  const [value, setValue] = useState(initialRv)
  const [flash, setFlash] = useState<'success' | 'error' | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const { beep } = useAudioFeedback()

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 50)
  }, [])

  function handleScan(scanned: string) {
    if (!scanned.trim()) return
    setValue(scanned)
    setFlash('success')
    beep('success')
    setTimeout(() => {
      setFlash(null)
      onComplete(scanned)
    }, 300)
  }

  function handleSubmit() {
    const v = value.trim()
    if (!v) return
    setFlash('success')
    beep('success')
    setTimeout(() => { setFlash(null); onComplete(v) }, 300)
  }

  useBarcodeScanner({ onScan: handleScan, minLength: 1, enabled: true })

  return (
    <div className={cn(
      'space-y-6 rounded-xl p-1 transition-colors duration-500',
      flash === 'success' && 'bg-green-50',
      flash === 'error'   && 'bg-red-50',
    )}>
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-primary">Etapa 2 — RV</h2>
        <p className="text-sm text-muted-foreground">Bipe o RV colado na caixa ou digite manualmente.</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="rv">Código RV</Label>
        <Input
          id="rv"
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="RV-00000"
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
        />
      </div>

      <div className="flex gap-3">
        <Button type="button" variant="outline" onClick={onBack} className="flex-1">
          Voltar
        </Button>
        <Button
          type="button"
          onClick={handleSubmit}
          disabled={!value.trim()}
          className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground"
        >
          Próximo
        </Button>
      </div>
    </div>
  )
}
