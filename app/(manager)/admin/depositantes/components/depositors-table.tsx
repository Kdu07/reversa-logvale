'use client'

import { useRef, useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { EmptyState } from '@/components/shared/empty-state'
import { ptBR } from '@/lib/i18n/pt-BR'
import { formatCnpj, normalizeCnpj } from '@/lib/depositor-cnpjs'
import { Building2, Trash2 } from 'lucide-react'
import {
  addDepositorCnpjAction,
  createDepositorAction,
  getDepositorUsageAction,
  reactivateDepositorAction,
  removeDepositorAction,
  removeDepositorCnpjAction,
  updateDepositorAction,
} from '../actions'
import type { DepositorRow, DepositorUsage } from '../actions'

const t = ptBR.admin.depositors

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

interface Props {
  rows: DepositorRow[]
}

interface FormState {
  cnpj:         string
  razao_social: string
}

const EMPTY_FORM: FormState = { cnpj: '', razao_social: '' }

export function DepositorsTable({ rows }: Props) {
  const [modalMode, setModalMode]    = useState<'create' | 'edit' | null>(null)
  const [editingRow, setEditingRow]  = useState<DepositorRow | null>(null)
  const [form, setForm]              = useState<FormState>(EMPTY_FORM)
  const [error, setError]            = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  // CNPJs adicionais (só no modo edição) — salvos na hora, fora do "Salvar".
  const [extraCnpjs, setExtraCnpjs]       = useState<string[]>([])
  const [newCnpj, setNewCnpj]             = useState('')
  const [cnpjError, setCnpjError]         = useState<string | null>(null)
  const [cnpjPending, startCnpjTransition] = useTransition()

  // Remover (exclui se não tem devoluções; senão desativa) e Reativar.
  const [removeTarget, setRemoveTarget]        = useState<DepositorRow | null>(null)
  const [usage, setUsage]                      = useState<DepositorUsage | null>(null)
  const [removeError, setRemoveError]          = useState<string | null>(null)
  const [notice, setNotice]                    = useState<string | null>(null)
  const [actionError, setActionError]          = useState<string | null>(null)
  const [removePending, startRemoveTransition] = useTransition()
  const usageFor = useRef<string | null>(null)

  function openRemove(d: DepositorRow) {
    usageFor.current = d.id
    setRemoveTarget(d)
    setUsage(null)
    setRemoveError(null)
    setNotice(null)
    setActionError(null)
    getDepositorUsageAction(d.id).then((result) => {
      if (usageFor.current !== d.id) return // fechou ou abriu outro no meio-tempo
      if ('error' in result) setRemoveError(result.error)
      else setUsage(result.data)
    })
  }

  function closeRemove() {
    usageFor.current = null
    setRemoveTarget(null)
    setUsage(null)
    setRemoveError(null)
  }

  function confirmRemove() {
    if (!removeTarget) return
    const target = removeTarget
    setRemoveError(null)
    startRemoveTransition(async () => {
      const result = await removeDepositorAction(target.id)
      if ('error' in result) { setRemoveError(result.error); return }
      closeRemove()
      setNotice(result.mode === 'deleted'
        ? `${target.razao_social} foi excluído.`
        : `${target.razao_social} foi desativado. O histórico de devoluções foi mantido e os CNPJs dele ficaram livres para outro depositante.`)
    })
  }

  function handleReactivate(d: DepositorRow) {
    setNotice(null)
    setActionError(null)
    startRemoveTransition(async () => {
      const result = await reactivateDepositorAction(d.id)
      if ('error' in result) setActionError(result.error)
      else setNotice(`${d.razao_social} foi reativado.`)
    })
  }

  function resetCnpjState(extras: string[] = []) {
    setExtraCnpjs(extras)
    setNewCnpj('')
    setCnpjError(null)
  }

  function openCreate() {
    setForm(EMPTY_FORM)
    setEditingRow(null)
    setError(null)
    resetCnpjState()
    setModalMode('create')
  }

  function openEdit(d: DepositorRow) {
    setForm({ cnpj: d.cnpj, razao_social: d.razao_social })
    setEditingRow(d)
    setError(null)
    resetCnpjState(d.extraCnpjs)
    setModalMode('edit')
  }

  function closeModal() {
    setModalMode(null)
    setEditingRow(null)
    setError(null)
    resetCnpjState()
  }

  function handleSave() {
    setError(null)
    startTransition(async () => {
      const result = modalMode === 'create'
        ? await createDepositorAction({ cnpj: form.cnpj, razao_social: form.razao_social })
        : await updateDepositorAction({ id: editingRow!.id, razao_social: form.razao_social })
      if ('error' in result) { setError(result.error); return }
      closeModal()
    })
  }

  function handleAddCnpj() {
    if (!editingRow || normalizeCnpj(newCnpj).length !== 14) return
    setCnpjError(null)
    startCnpjTransition(async () => {
      const result = await addDepositorCnpjAction({ depositorId: editingRow.id, cnpj: newCnpj })
      if ('error' in result) { setCnpjError(result.error); return }
      setExtraCnpjs((list) => [...list, result.cnpj])
      setNewCnpj('')
    })
  }

  function handleRemoveCnpj(cnpj: string) {
    if (!editingRow) return
    setCnpjError(null)
    startCnpjTransition(async () => {
      const result = await removeDepositorCnpjAction({ depositorId: editingRow.id, cnpj })
      if ('error' in result) { setCnpjError(result.error); return }
      setExtraCnpjs((list) => list.filter((c) => c !== cnpj))
    })
  }

  const canSave = form.razao_social.trim().length > 0 &&
    (modalMode === 'edit' || normalizeCnpj(form.cnpj).length === 14)
  const canAddCnpj = normalizeCnpj(newCnpj).length === 14

  return (
    <>
      <div className="flex justify-end">
        <Button onClick={openCreate} size="sm">
          {t.createBtn}
        </Button>
      </div>

      {(notice || actionError) && (
        <Alert variant={actionError ? 'destructive' : 'default'}>
          <AlertDescription>{actionError ?? notice}</AlertDescription>
        </Alert>
      )}

      {rows.length === 0 ? (
        <EmptyState icon={Building2} title="Nenhum depositante" description={ptBR.common.noResults} />
      ) : (
        <div className="rounded-lg border border-border overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b bg-muted/30">
                <th className="px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">{t.colCnpj}</th>
                <th className="px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">{t.colName}</th>
                <th className="px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">{t.colClients}</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((d) => (
                <tr key={d.id} className="hover:bg-muted/30 transition-colors ease-quint">
                  <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground whitespace-nowrap">
                    <div>{formatCnpj(d.cnpj)}</div>
                    {d.extraCnpjs.map((c) => (
                      <div key={c} className="text-[11px] text-muted-foreground/70" title={t.extraCnpjsTitle}>
                        + {formatCnpj(c)}
                      </div>
                    ))}
                  </td>
                  <td className={`px-4 py-2.5 font-medium ${d.active ? 'text-foreground' : 'text-muted-foreground'}`}>
                    <span className="inline-flex flex-wrap items-center gap-2">
                      {d.razao_social}
                      {!d.active && <Badge variant="secondary">{t.inactiveBadge}</Badge>}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {d.clientNames.length === 0 ? (
                      <span className="text-xs">—</span>
                    ) : (
                      <span className="text-xs">
                        {d.clientNames.slice(0, 3).join(', ')}
                        {d.clientNames.length > 3 && ` +${d.clientNames.length - 3}`}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right whitespace-nowrap">
                    <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={() => openEdit(d)}>
                      {t.editBtn}
                    </Button>
                    {d.active ? (
                      <button
                        type="button"
                        onClick={() => openRemove(d)}
                        disabled={removePending}
                        aria-label={`${t.removeBtn} ${d.razao_social}`}
                        title={t.removeBtn}
                        className="ml-1 inline-flex h-7 w-7 items-center justify-center rounded-md align-middle text-destructive/80 transition-colors ease-quint hover:bg-muted hover:text-destructive disabled:pointer-events-none disabled:opacity-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    ) : (
                      <Button
                        type="button" variant="ghost" size="sm" className="ml-1 h-7 text-xs"
                        onClick={() => handleReactivate(d)} disabled={removePending}
                      >
                        {t.reactivateBtn}
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={!!modalMode} onOpenChange={(o) => !o && closeModal()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{modalMode === 'create' ? t.createTitle : t.editTitle}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-muted-foreground">{t.fieldCnpj}</label>
              <input
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 disabled:cursor-not-allowed"
                value={form.cnpj}
                readOnly={modalMode === 'edit'}
                disabled={modalMode === 'edit'}
                maxLength={18}
                onChange={(e) => setForm((f) => ({ ...f, cnpj: e.target.value }))}
                placeholder="00000000000000"
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-muted-foreground">{t.fieldName}</label>
              <input
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                value={form.razao_social}
                onChange={(e) => setForm((f) => ({ ...f, razao_social: e.target.value }))}
              />
            </div>

            {modalMode === 'edit' && editingRow && (
              <div className="space-y-2 border-t border-border pt-4">
                <div className="space-y-0.5">
                  <p className="text-xs font-medium text-muted-foreground">{t.extraCnpjsTitle}</p>
                  <p className="text-xs text-muted-foreground/80">{t.extraCnpjsHint}</p>
                </div>

                {extraCnpjs.length === 0 ? (
                  <p className="text-xs text-muted-foreground">{t.extraCnpjsEmpty}</p>
                ) : (
                  <ul className="divide-y divide-border rounded-md border border-border">
                    {extraCnpjs.map((c) => (
                      <li key={c} className="flex items-center justify-between px-3 py-1.5">
                        <span className="font-mono text-xs text-foreground">{formatCnpj(c)}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveCnpj(c)}
                          disabled={cnpjPending}
                          aria-label={`${t.removeCnpj} ${formatCnpj(c)}`}
                          title={t.removeCnpj}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-destructive/80 transition-colors ease-quint hover:bg-muted hover:text-destructive disabled:pointer-events-none disabled:opacity-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                <div className="flex gap-2">
                  <input
                    className="min-w-0 flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    value={newCnpj}
                    maxLength={18}
                    inputMode="numeric"
                    aria-label={t.extraCnpjsTitle}
                    placeholder="00000000000000"
                    onChange={(e) => setNewCnpj(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') { e.preventDefault(); handleAddCnpj() }
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleAddCnpj}
                    disabled={cnpjPending || !canAddCnpj}
                  >
                    {t.addCnpjBtn}
                  </Button>
                </div>

                {cnpjError && <p className="text-xs text-destructive">{cnpjError}</p>}
              </div>
            )}

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={closeModal} disabled={isPending}>
              {ptBR.common.cancel}
            </Button>
            <Button type="button" onClick={handleSave} disabled={isPending || !canSave}>
              {isPending ? t.saving : ptBR.common.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!removeTarget} onOpenChange={(o) => !o && !removePending && closeRemove()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {!usage
                ? `${t.removeBtn} ${removeTarget?.razao_social ?? ''}`
                : usage.returns > 0
                  ? `Desativar ${removeTarget?.razao_social}?`
                  : `Excluir ${removeTarget?.razao_social}?`}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-2 text-sm text-muted-foreground">
            {!usage && !removeError && <p className="animate-pulse">{t.checkingUsage}</p>}

            {usage && usage.returns > 0 && (
              <>
                <p>
                  Este depositante tem{' '}
                  <strong className="text-foreground">{plural(usage.returns, 'devolução', 'devoluções')}</strong>
                  {usage.awaiting > 0 && ` (${usage.awaiting} aguardando decisão)`}, então não pode ser excluído
                  sem apagar o histórico.
                </p>
                <p>
                  Ele será <strong className="text-foreground">desativado</strong>: deixa de aparecer no recebimento,
                  na sugestão pela NF e nas listas de seleção. As devoluções e os vínculos com clientes ficam, e os
                  CNPJs dele ficam livres para cadastrar em outro depositante.
                </p>
                <p>
                  Dá para reativar depois, desde que nenhum CNPJ dele esteja em uso por outro depositante ativo.
                </p>
              </>
            )}

            {usage && usage.returns === 0 && (
              <>
                <p>
                  Nenhuma devolução usa este depositante. Ele será{' '}
                  <strong className="text-foreground">excluído definitivamente</strong>
                  {usage.clients > 0 && `, junto com o vínculo com ${plural(usage.clients, 'cliente', 'clientes')}`} e
                  os CNPJs dele.
                </p>
                <p>Não dá para desfazer.</p>
              </>
            )}

            {removeError && (
              <Alert variant="destructive">
                <AlertDescription>{removeError}</AlertDescription>
              </Alert>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={closeRemove} disabled={removePending}>
              {ptBR.common.cancel}
            </Button>
            <Button
              type="button"
              variant={usage && usage.returns > 0 ? 'default' : 'destructive'}
              onClick={confirmRemove}
              disabled={!usage || removePending}
            >
              {removePending
                ? t.removing
                : usage && usage.returns > 0 ? t.deactivateConfirm : t.deleteConfirm}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
