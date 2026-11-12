'use client'

import { useRef, useEffect, useLayoutEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2, type LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

type Condition = 'good' | 'damaged'

interface StepItemCountProps {
  itemCount:        number | null
  /** null = ainda não escolhido · 0 = Bom · >0 = Avaria. */
  damagedItemCount: number | null
  onComplete:       (count: number, damaged: number) => void
  onBack:           () => void
}

/** Inteiro positivo digitado num input numérico, ou NaN. */
function toInt(raw: string): number {
  if (raw.trim() === '') return NaN
  const n = Number(raw)
  return Number.isInteger(n) ? n : NaN
}

/** Atalhos de letra não valem enquanto o foco está num campo de texto. */
function isTypingTarget(target: EventTarget | null): boolean {
  if (target instanceof HTMLTextAreaElement) return true
  if (target instanceof HTMLInputElement) return target.type !== 'number'
  return target instanceof HTMLElement && target.isContentEditable
}

export function StepItemCount({ itemCount, damagedItemCount, onComplete, onBack }: StepItemCountProps) {
  const [value, setValue] = useState(itemCount !== null ? String(itemCount) : '')
  const [condition, setCondition] = useState<Condition | null>(
    damagedItemCount === null ? null : damagedItemCount === 0 ? 'good' : 'damaged',
  )
  const [damagedValue, setDamagedValue] = useState(
    damagedItemCount !== null && damagedItemCount > 0 ? String(damagedItemCount) : '',
  )
  const inputRef   = useRef<HTMLInputElement>(null)
  const damagedRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 50)
  }, [])

  const count        = toInt(value)
  const countValid   = count > 0
  const damaged      = toInt(damagedValue)
  const damagedValid = damaged > 0
  const tooMany      = condition === 'damaged' && countValid && damagedValid && damaged > count

  const valid =
    countValid &&
    (condition === 'good' || (condition === 'damaged' && damagedValid && damaged <= count))

  function chooseGood() {
    setCondition('good')
  }

  // Marca Avaria → foco vai para "Quantos avariados?" logo após o campo
  // aparecer (layout effect, antes da próxima tecla — um setTimeout deixava o
  // dígito seguinte cair na quantidade).
  const [focusDamaged, setFocusDamaged] = useState(0)
  useLayoutEffect(() => {
    if (focusDamaged === 0) return
    damagedRef.current?.focus()
    damagedRef.current?.select()
  }, [focusDamaged])

  function chooseDamaged() {
    setCondition('damaged')
    // Com 1 item só, o único valor possível é 1.
    if (count === 1) setDamagedValue('1')
    setFocusDamaged((n) => n + 1)
  }

  function handleSubmit() {
    if (!valid) return
    onComplete(count, condition === 'good' ? 0 : damaged)
  }

  // Sempre a versão mais recente dos handlers, sem re-registrar o listener.
  const handlers = useRef({ chooseGood, chooseDamaged, handleSubmit })
  handlers.current = { chooseGood, chooseDamaged, handleSubmit }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return

      if (e.key === 'Enter') {
        // Enter num botão já aciona o próprio botão.
        if (e.target instanceof HTMLButtonElement) return
        e.preventDefault()
        handlers.current.handleSubmit()
        return
      }

      if (isTypingTarget(e.target)) return
      const key = e.key.toLowerCase()
      if (key === 'b') {
        e.preventDefault()
        handlers.current.chooseGood()
      } else if (key === 'a') {
        e.preventDefault()
        handlers.current.chooseDamaged()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-primary">Etapa 3 — Itens</h2>
        <p className="text-sm text-muted-foreground">
          Informe quantos itens estão na caixa e o estado dos produtos.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="item-count">Quantidade de itens</Label>
        <Input
          id="item-count"
          ref={inputRef}
          type="number"
          inputMode="numeric"
          min={1}
          step={1}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="1"
          className="text-2xl h-14 text-center"
        />
      </div>

      <div className="space-y-2">
        <p id="condition-label" className="text-sm font-medium leading-none">Estado dos produtos</p>
        <div role="group" aria-labelledby="condition-label" className="grid grid-cols-2 gap-3">
          <ConditionOption
            label="Bom"
            shortcut="B"
            icon={CheckCircle2}
            selected={condition === 'good'}
            selectedClass="border-green-500 bg-green-100 text-green-800"
            onSelect={chooseGood}
          />
          <ConditionOption
            label="Avaria"
            shortcut="A"
            icon={AlertTriangle}
            selected={condition === 'damaged'}
            selectedClass="border-amber-500 bg-amber-100 text-amber-800"
            onSelect={chooseDamaged}
          />
        </div>
      </div>

      {condition === 'damaged' && (
        <div className="space-y-2">
          <Label htmlFor="damaged-count">Quantos avariados?</Label>
          <div className="flex items-center gap-3">
            <Input
              id="damaged-count"
              ref={damagedRef}
              type="number"
              inputMode="numeric"
              min={1}
              max={countValid ? count : undefined}
              step={1}
              value={damagedValue}
              onChange={(e) => setDamagedValue(e.target.value)}
              placeholder="1"
              aria-invalid={tooMany}
              aria-describedby={tooMany ? 'damaged-count-error' : undefined}
              className="text-2xl h-14 text-center"
            />
            <span className="text-sm text-muted-foreground whitespace-nowrap">
              de {countValid ? count : '—'}
            </span>
          </div>
          {tooMany && (
            <p id="damaged-count-error" className="text-sm text-destructive">
              Avariados não pode passar de {count}.
            </p>
          )}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Atalhos: <Kbd>B</Kbd> Bom · <Kbd>A</Kbd> Avaria · <Kbd>Enter</Kbd> Próximo
      </p>

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

function ConditionOption({
  label, shortcut, icon: Icon, selected, selectedClass, onSelect,
}: {
  label:         string
  shortcut:      string
  icon:          LucideIcon
  selected:      boolean
  selectedClass: string
  onSelect:      () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={cn(
        'flex h-16 items-center justify-center gap-2 rounded-lg border-2 text-base font-semibold',
        'transition-colors ease-quint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        selected ? selectedClass : 'border-border text-foreground hover:bg-muted/50',
      )}
    >
      <Icon className="h-5 w-5" aria-hidden />
      {label}
      <span className="sr-only">(atalho {shortcut})</span>
    </button>
  )
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded border border-border bg-muted px-1 py-0.5 font-mono text-[10px] text-foreground">
      {children}
    </kbd>
  )
}
