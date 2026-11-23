'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { accessKeyEmitterCnpj, normalizeAccessKey } from '@/lib/access-key'
import { cn } from '@/lib/utils'
import { MISMATCH_DESCRIPTION_MAX } from '@/lib/item-mismatch'
import {
  getEditReturnDataAction,
  updateReturnAction,
  type EditReturnData,
} from '@/lib/actions/edit-return'
import type { IdentifierType } from '@/types'

type Condition = 'good' | 'damaged' | 'empty' | 'mismatched' | 'unrated'

const IDENTIFIER_OPTIONS: { value: IdentifierType; label: string }[] = [
  { value: 'access_key',     label: 'Chave de acesso' },
  { value: 'postal_code',    label: 'CEP' },
  { value: 'logistics_code', label: 'Código de Logística Reversa' },
  { value: 'illegible',      label: 'Ilegível' },
]

const FIELD_CLASS =
  'h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring'

const DEADLINE_MS = 72 * 60 * 60 * 1000

function formatRemaining(deadlineFrom: string): string {
  const ms = new Date(deadlineFrom).getTime() + DEADLINE_MS - Date.now()
  if (ms <= 0) return 'prazo já esgotado'
  const h = Math.floor(ms / (60 * 60 * 1000))
  return h >= 1 ? `restam ~${h}h` : 'resta menos de 1h'
}

interface Props {
  returnId: string
  onClose:  () => void
  /** Chamado depois de salvar com sucesso (a action já revalida as rotas). */
  onSaved?: () => void
}

/**
 * Edição de devolução (operador aguardando decisão / gerente em qualquer
 * status). Carrega o estado atual no servidor ao abrir, para não editar sobre
 * dados velhos da listagem.
 */
export function EditReturnDialog({ returnId, onClose, onSaved }: Props) {
  const [data, setData]       = useState<EditReturnData | null>(null)
  const [loadErr, setLoadErr] = useState<string | null>(null)
  const [error, setError]     = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const [rv, setRv]                     = useState('')
  const [identifierType, setIdentifier] = useState<IdentifierType>('access_key')
  const [accessKey, setAccessKey]       = useState('')
  const [postalCode, setPostalCode]     = useState('')
  const [logisticsCode, setLogistics]   = useState('')
  const [depositorId, setDepositorId]   = useState('')
  const [itemCount, setItemCount]       = useState('')
  const [condition, setCondition]       = useState<Condition>('good')
  const [damaged, setDamaged]           = useState('')
  const [mismatched, setMismatched]     = useState('')
  const [mismatchDesc, setMismatchDesc] = useState('')
  const [finalCustomer, setFinalCustomer] = useState('')
  const [restartDeadline, setRestart]   = useState<boolean | null>(null)

  useEffect(() => {
    let alive = true
    getEditReturnDataAction(returnId).then((res) => {
      if (!alive) return
      if ('error' in res) { setLoadErr(res.error); return }
      const d = res.data
      setData(d)
      setRv(d.rv)
      setIdentifier(d.identifierType)
      setAccessKey(d.accessKey ?? '')
      setPostalCode(d.postalCode ?? '')
      setLogistics(d.logisticsCode ?? '')
      setDepositorId(d.depositorId ?? '')
      setItemCount(String(d.itemCount))
      setCondition(
        d.itemCount === 0           ? 'empty'      :
        d.mismatchedItemCount       ? 'mismatched' :
        d.damagedItemCount === null ? 'unrated'    :
        d.damagedItemCount > 0      ? 'damaged' : 'good',
      )
      setDamaged(d.damagedItemCount && d.damagedItemCount > 0 ? String(d.damagedItemCount) : '')
      setMismatched(d.mismatchedItemCount ? String(d.mismatchedItemCount) : '')
      setMismatchDesc(d.mismatchDescription ?? '')
      setFinalCustomer(d.finalCustomerName ?? '')
    })
    return () => { alive = false }
  }, [returnId])

  const selectedDepositor = data?.depositors.find((d) => d.id === depositorId) ?? null
  const depositorChanged  = !!data && (data.depositorId ?? '') !== depositorId
  const asksDeadline =
    !!data && depositorChanged && data.status === 'awaiting_decision'
    && !!selectedDepositor && !selectedDepositor.noDecisionDeadline

  const cleanKey = normalizeAccessKey(accessKey)
  const cnpjMismatch = useMemo(() => {
    if (cleanKey.length !== 44 || !selectedDepositor) return false
    // Qualquer CNPJ do depositante vale, não só o principal (migration 026).
    return !selectedDepositor.cnpjs.includes(accessKeyEmitterCnpj(cleanKey))
  }, [cleanKey, selectedDepositor])

  const count     = condition === 'empty' ? 0 : Number(itemCount)
  const countOk   = condition === 'empty' || (Number.isInteger(count) && count > 0)
  const damagedN  = Number(damaged)
  const damagedOk = condition !== 'damaged' || (Number.isInteger(damagedN) && damagedN >= 1 && countOk && damagedN <= count)
  const mismatchedN  = Number(mismatched)
  const mismatchedOk = condition !== 'mismatched' || (Number.isInteger(mismatchedN) && mismatchedN >= 1 && countOk && mismatchedN <= count)
  const mismatchDescOk = condition !== 'mismatched' || mismatchDesc.trim() !== ''
  const canSave   = !!data && rv.trim() !== '' && countOk && damagedOk && mismatchedOk && mismatchDescOk
    && (!asksDeadline || restartDeadline !== null)

  function chooseCondition(c: Condition) {
    setCondition(c)
    if (c === 'empty') setItemCount('0')
    else if (condition === 'empty') setItemCount('')
    if (c !== 'damaged') setDamaged('')
  }

  function handleSave() {
    if (!data) return
    setError(null)
    startTransition(async () => {
      const res = await updateReturnAction(data.id, {
        rv,
        identifierType,
        accessKey:         accessKey || null,
        postalCode:        identifierType === 'postal_code'    ? postalCode    : null,
        logisticsCode:     identifierType === 'logistics_code' ? logisticsCode : null,
        itemCount:         count,
        damagedItemCount:
          condition === 'empty'      ? 0 :
          condition === 'good'       ? 0 :
          condition === 'mismatched' ? 0 :
          condition === 'damaged'    ? damagedN : null,
        mismatch:
          condition === 'mismatched' ? { count: mismatchedN, description: mismatchDesc } : null,
        depositorId:       depositorId || null,
        finalCustomerName: finalCustomer || null,
        restartDeadline:   asksDeadline ? restartDeadline : null,
      })
      if ('error' in res) { setError(res.error); return }
      onSaved?.()
      onClose()
    })
  }

  return (
    <Dialog open onOpenChange={(o) => !o && !isPending && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar devolução{data ? <> <span className="font-mono">{data.rv}</span></> : null}</DialogTitle>
          <DialogDescription>
            As alterações ficam registradas no histórico da devolução (quem, quando, antes e depois).
          </DialogDescription>
        </DialogHeader>

        {loadErr ? (
          <Alert variant="destructive"><AlertDescription>{loadErr}</AlertDescription></Alert>
        ) : !data ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Carregando…</p>
        ) : (
          <div className="space-y-5 py-1">
            {/* RV */}
            <div className="space-y-1.5">
              <Label htmlFor="edit-rv">RV</Label>
              <Input id="edit-rv" value={rv} onChange={(e) => setRv(e.target.value)} className="font-mono" />
            </div>

            {/* Identificação */}
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="edit-identifier">Identificação da caixa</Label>
                <select
                  id="edit-identifier"
                  className={FIELD_CLASS}
                  value={identifierType}
                  onChange={(e) => setIdentifier(e.target.value as IdentifierType)}
                >
                  {IDENTIFIER_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>

              {identifierType === 'postal_code' && (
                <div className="space-y-1.5">
                  <Label htmlFor="edit-postal">CEP (8 dígitos)</Label>
                  <Input id="edit-postal" inputMode="numeric" value={postalCode} onChange={(e) => setPostalCode(e.target.value)} />
                </div>
              )}
              {identifierType === 'logistics_code' && (
                <div className="space-y-1.5">
                  <Label htmlFor="edit-logistics">Código de Logística Reversa</Label>
                  <Input id="edit-logistics" value={logisticsCode} onChange={(e) => setLogistics(e.target.value)} />
                </div>
              )}
              {identifierType === 'illegible' && (
                <p className="text-xs text-muted-foreground">
                  {data.illegibleToken
                    ? <>Token ilegível: <span className="font-mono">{data.illegibleToken}</span></>
                    : 'Um token "ILEG-…" será gerado ao salvar.'}
                </p>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="edit-key">
                  Chave de acesso (NF origem){identifierType !== 'access_key' && <span className="text-muted-foreground font-normal"> — opcional</span>}
                </Label>
                <Input
                  id="edit-key"
                  inputMode="numeric"
                  value={accessKey}
                  onChange={(e) => setAccessKey(e.target.value)}
                  placeholder="44 dígitos"
                  className="font-mono text-xs"
                />
                {cleanKey.length > 0 && cleanKey.length !== 44 && (
                  <p className="text-xs text-muted-foreground">{cleanKey.length}/44 dígitos</p>
                )}
              </div>
            </div>

            {/* Depositante */}
            <div className="space-y-1.5">
              <Label htmlFor="edit-depositor">Depositante</Label>
              <select
                id="edit-depositor"
                className={FIELD_CLASS}
                value={depositorId}
                onChange={(e) => { setDepositorId(e.target.value); setRestart(null) }}
              >
                <option value="">— Sem depositante —</option>
                {data.depositors.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
              {cnpjMismatch && (
                <Alert className="border-warning/40 bg-warning/10">
                  <AlertDescription className="text-xs">
                    O CNPJ emitente da chave de acesso não é o CNPJ deste depositante. Confira antes de salvar.
                  </AlertDescription>
                </Alert>
              )}
            </div>

            {asksDeadline && (
              <fieldset className="space-y-2 rounded-md border border-border p-3">
                <legend className="px-1 text-sm font-medium">Prazo de 72h do novo cliente</legend>
                <label className="flex items-start gap-2 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="restart-deadline"
                    className="mt-0.5"
                    checked={restartDeadline === false}
                    onChange={() => setRestart(false)}
                  />
                  <span>
                    Manter o prazo atual
                    <span className="block text-xs text-muted-foreground">({formatRemaining(data.deadlineFrom)})</span>
                  </span>
                </label>
                <label className="flex items-start gap-2 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="restart-deadline"
                    className="mt-0.5"
                    checked={restartDeadline === true}
                    onChange={() => setRestart(true)}
                  />
                  <span>
                    Reiniciar o prazo agora
                    <span className="block text-xs text-muted-foreground">(72h a partir da edição)</span>
                  </span>
                </label>
              </fieldset>
            )}

            {/* Itens + estado */}
            <div className="space-y-2">
              <p id="edit-condition-label" className="text-sm font-medium leading-none">Itens e estado dos produtos</p>
              <div role="group" aria-labelledby="edit-condition-label" className="grid grid-cols-3 gap-2">
                <ConditionButton label="Bom"         selected={condition === 'good'}    selectedClass="border-green-500 bg-green-100 text-green-800" onClick={() => chooseCondition('good')} />
                <ConditionButton label="Avaria"      selected={condition === 'damaged'} selectedClass="border-amber-500 bg-amber-100 text-amber-800" onClick={() => chooseCondition('damaged')} />
                <ConditionButton label="Caixa vazia" selected={condition === 'empty'}   selectedClass="border-slate-500 bg-slate-100 text-slate-800" onClick={() => chooseCondition('empty')} />
                <ConditionButton
                  label="Produto não corresponde"
                  selected={condition === 'mismatched'}
                  selectedClass="border-violet-500 bg-violet-100 text-violet-800"
                  onClick={() => chooseCondition('mismatched')}
                  className="col-span-3"
                />
              </div>
              {condition === 'unrated' && (
                <p className="text-xs text-muted-foreground">Estado não avaliado no recebimento — escolha um para registrar.</p>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="edit-count">Nº de itens</Label>
                  <Input
                    id="edit-count"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    step={1}
                    value={itemCount}
                    disabled={condition === 'empty'}
                    onChange={(e) => setItemCount(e.target.value)}
                  />
                </div>
                {condition === 'damaged' && (
                  <div className="space-y-1.5">
                    <Label htmlFor="edit-damaged">Avariados</Label>
                    <Input
                      id="edit-damaged"
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={countOk ? count : undefined}
                      step={1}
                      value={damaged}
                      aria-invalid={!damagedOk}
                      onChange={(e) => setDamaged(e.target.value)}
                    />
                  </div>
                )}
                {condition === 'mismatched' && (
                  <div className="space-y-1.5">
                    <Label htmlFor="edit-mismatched">Não correspondem à NF</Label>
                    <Input
                      id="edit-mismatched"
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={countOk ? count : undefined}
                      step={1}
                      value={mismatched}
                      aria-invalid={!mismatchedOk}
                      onChange={(e) => setMismatched(e.target.value)}
                    />
                  </div>
                )}
              </div>
              {condition === 'damaged' && damaged !== '' && !damagedOk && (
                <p className="text-xs text-destructive">Avariados deve ser de 1 a {countOk ? count : 'nº de itens'}.</p>
              )}
              {condition === 'mismatched' && (
                <>
                  {mismatched !== '' && !mismatchedOk && (
                    <p className="text-xs text-destructive">Deve ser de 1 a {countOk ? count : 'nº de itens'}.</p>
                  )}
                  <div className="space-y-1.5">
                    <Label htmlFor="edit-mismatch-desc">O que veio na caixa</Label>
                    <Input
                      id="edit-mismatch-desc"
                      value={mismatchDesc}
                      maxLength={MISMATCH_DESCRIPTION_MAX}
                      onChange={(e) => setMismatchDesc(e.target.value)}
                      placeholder="Ex.: camiseta P azul em vez de M preta"
                    />
                  </div>
                </>
              )}
              {data.itemCount === 0 && condition !== 'empty' && (
                <p className="text-xs text-muted-foreground">
                  Recebida como caixa vazia: a devolução continuará sem fotos de itens.
                </p>
              )}
            </div>

            {/* Cliente final */}
            <div className="space-y-1.5">
              <Label htmlFor="edit-final-customer">Cliente final</Label>
              <Input id="edit-final-customer" value={finalCustomer} onChange={(e) => setFinalCustomer(e.target.value)} />
            </div>

            {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>Cancelar</Button>
          {data && (
            <Button type="button" onClick={handleSave} disabled={!canSave || isPending}>
              {isPending ? 'Salvando…' : 'Salvar alterações'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ConditionButton({
  label, selected, selectedClass, onClick, className,
}: { label: string; selected: boolean; selectedClass: string; onClick: () => void; className?: string }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        'h-10 rounded-md border-2 px-2 text-sm font-semibold transition-colors ease-quint',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        selected ? selectedClass : 'border-border text-foreground hover:bg-muted/50',
        className,
      )}
    >
      {label}
    </button>
  )
}
