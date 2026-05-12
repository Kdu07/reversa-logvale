'use client'

import { useRef, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface StepItemCountProps {
  itemCount:  number | null
  onComplete: (count: number) => void
  onBack:     () => void
}

export function StepItemCount({ itemCount, onComplete, onBack }: StepItemCountProps) {
  const [value, setValue] = useState(itemCount !== null ? String(itemCount) : '')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 50)
  }, [])

  const parsed = parseInt(value, 10)
  const valid  = !isNaN(parsed) && parsed > 0

  function handleSubmit() {
    if (!valid) return
    onComplete(parsed)
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-primary">Etapa 3 — Número de Itens</h2>
        <p className="text-sm text-muted-foreground">Informe quantos itens estão na caixa.</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="item-count">Quantidade de itens</Label>
        <Input
          id="item-count"
          ref={inputRef}
          type="number"
          min={1}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="1"
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          className="text-2xl h-14 text-center"
        />
      </div>

      <div className="flex gap-3">
        <Button type="button" variant="outline" onClick={onBack} className="flex-1">
          Voltar
        </Button>
        <Button
          type="button"
          onClick={handleSubmit}
          disabled={!valid}
          className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground"
        >
          Próximo
        </Button>
      </div>
    </div>
  )
}
