'use client'

import { useRef, useEffect, useLayoutEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2, PackageOpen, Shuffle, type LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { MISMATCH_DESCRIPTION_MAX, type MismatchInput } from '@/lib/item-mismatch'

type Condition = 'good' | 'damaged' | 'empty' | 'mismatched'

interface StepItemCountProps {
  /** 0 = Caixa vazia. */
  itemCount:        number | null
  /** null = ainda não escolhido · 0 = Bom (ou Caixa vazia, se itemCount = 0) · >0 = Avaria. */
  damagedItemCount: number | null
  /** Produto não corresponde à NF (quantos + o que veio); null = não é o caso. */
  mismatch:         MismatchInput | null
  onComplete:       (count: number, damaged: number, mismatch: MismatchInput | null) => void
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

export function StepItemCount({ itemCount, damagedItemCount, mismatch, onComplete, onBack }: StepItemCountProps) {
  const [value, setValue] = useState(itemCount !== null && itemCount > 0 ? String(itemCount) : '')
  const [condition, setCondition] = useState<Condition | null>(
    itemCount === 0 ? 'empty'
      : mismatch ? 'mismatched'
      : damagedItemCount === null ? null
      : damagedItemCount === 0 ? 'good'
      : 'damaged',
  )
  const [damagedValue, setDamagedValue] = useState(
    damagedItemCount !== null && damagedItemCount > 0 ? String(damagedItemCount) : '',
  )
  const [mismatchedValue, setMismatchedValue] = useState(mismatch ? String(mismatch.count) : '')
  const [description, setDescription]         = useState(mismatch?.description ?? '')
  const inputRef       = useRef<HTMLInputElement>(null)
  const damagedRef     = useRef<HTMLInputElement>(null)
  const mismatchedRef  = useRef<HTMLInputElement>(null)
  const descriptionRef = useRef<HTMLInputElement>(null)
  const rootRef        = useRef<HTMLDivElement>(null)

  // Foco inicial na quantidade, com um pequeno atraso (transição entre etapas).
  // Só age se o cursor ainda não está dentro desta etapa: um clique ou atalho
  // feito nesses 50 ms (ex.: Avaria, que leva o foco para "Quantos avariados?")
  // não pode ter o cursor puxado de volta. Era isso que deixava o teste da
  // Etapa 3 instável no CI.
  useEffect(() => {
    const timer = setTimeout(() => {
      if (rootRef.current?.contains(document.activeElement)) return
      inputRef.current?.focus()
    }, 50)
    return () => clearTimeout(timer)
  }, [])

  const count        = toInt(value)
  const countValid   = count > 0
  const damaged      = toInt(damagedValue)
  const damagedValid = damaged > 0
  const tooMany      = condition === 'damaged' && countValid && damagedValid && damaged > count
  const mismatched      = toInt(mismatchedValue)
  const mismatchedValid = mismatched > 0
  const tooManyMismatch = condition === 'mismatched' && countValid && mismatchedValid && mismatched > count
  const descriptionOk   = description.trim().length > 0

  const isEmpty = condition === 'empty'
  const valid =
    isEmpty ||
    (countValid &&
      (condition === 'good' ||
        (condition === 'damaged' && damagedValid && damaged <= count) ||
        (condition === 'mismatched' && mismatchedValid && mismatched <= count && descriptionOk)))

  function chooseGood() {
    setCondition('good')
  }

  // Caixa vazia: não há o que contar — a quantidade fica travada em 0 (o valor
  // digitado é preservado e volta se o operador trocar para Bom/Avaria).
  function chooseEmpty() {
    setCondition('empty')
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

  // Produto não corresponde → foco em "Quantos não correspondem?" (ou, com 1
  // item só, direto em "O que veio na caixa?").
  const [focusMismatch, setFocusMismatch] = useState<{ n: number; toDescription: boolean }>({ n: 0, toDescription: false })
  useLayoutEffect(() => {
    if (focusMismatch.n === 0) return
    const target = focusMismatch.toDescription ? descriptionRef.current : mismatchedRef.current
    target?.focus()
    target?.select()
  }, [focusMismatch])

  function chooseMismatched() {
    setCondition('mismatched')
    // Com 1 item só, o único valor possível é 1.
    if (count === 1) setMismatchedValue('1')
    setFocusMismatch((f) => ({ n: f.n + 1, toDescription: count === 1 }))
  }

  function handleSubmit() {
    if (!valid) return
    if (condition === 'empty') onComplete(0, 0, null)
    else if (condition === 'mismatched') {
      onComplete(count, 0, { count: mismatched, description: description.trim() })
    } else onComplete(count, condition === 'good' ? 0 : damaged, null)
  }

  // Sempre a versão mais recente dos handlers, sem re-registrar o listener.
  const handlers = useRef({ chooseGood, chooseDamaged, chooseEmpty, chooseMismatched, handleSubmit })
  handlers.current = { chooseGood, chooseDamaged, chooseEmpty, chooseMismatched, handleSubmit }

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
      } else if (key === 'v') {
        e.preventDefault()
        handlers.current.chooseEmpty()
      } else if (key === 'n') {
        e.preventDefault()
        handlers.current.chooseMismatched()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  return (
    <div ref={rootRef} className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-primary">Etapa 3 — Itens</h2>
        <p className="text-sm text-muted-foreground">
          Informe quantos itens estão na caixa e o estado dos produtos — ou marque Caixa vazia.
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
          value={isEmpty ? '0' : value}
          onChange={(e) => setValue(e.target.value)}
          disabled={isEmpty}
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
          <ConditionOption
            label="Caixa vazia"
            shortcut="V"
            icon={PackageOpen}
            selected={isEmpty}
            selectedClass="border-slate-500 bg-slate-100 text-slate-800"
            onSelect={chooseEmpty}
          />
          <ConditionOption
            label="Produto não corresponde"
            shortcut="N"
            icon={Shuffle}
            selected={condition === 'mismatched'}
            selectedClass="border-violet-500 bg-violet-100 text-violet-800"
            onSelect={chooseMismatched}
          />
        </div>
      </div>

      {condition === 'mismatched' && (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="mismatched-count">Quantos não correspondem à NF?</Label>
            <div className="flex items-center gap-3">
              <Input
                id="mismatched-count"
                ref={mismatchedRef}
                type="number"
                inputMode="numeric"
                min={1}
                max={countValid ? count : undefined}
                step={1}
                value={mismatchedValue}
                onChange={(e) => setMismatchedValue(e.target.value)}
                placeholder="1"
                aria-invalid={tooManyMismatch}
                aria-describedby={tooManyMismatch ? 'mismatched-count-error' : undefined}
                className="text-2xl h-14 text-center"
              />
              <span className="text-sm text-muted-foreground whitespace-nowrap">
                de {countValid ? count : '—'}
              </span>
            </div>
            {tooManyMismatch && (
              <p id="mismatched-count-error" className="text-sm text-destructive">
                Não pode passar de {count}.
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="mismatch-description">O que veio na caixa?</Label>
            <Input
              id="mismatch-description"
              ref={descriptionRef}
              value={description}
              maxLength={MISMATCH_DESCRIPTION_MAX}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex.: camiseta P azul em vez de M preta"
            />
          </div>
        </div>
      )}

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
        Atalhos: <Kbd>B</Kbd> Bom · <Kbd>A</Kbd> Avaria · <Kbd>V</Kbd> Caixa vazia · <Kbd>N</Kbd> Não corresponde · <Kbd>Enter</Kbd> Próximo
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
        'flex h-16 items-center justify-center gap-2 rounded-lg border-2 px-2 text-center text-base font-semibold leading-tight',
        'transition-colors ease-quint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        selected ? selectedClass : 'border-border text-foreground hover:bg-muted/50',
      )}
    >
      <Icon className="h-5 w-5 shrink-0" aria-hidden />
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
