'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { EmptyState } from '@/components/shared/empty-state'
import { ptBR } from '@/lib/i18n/pt-BR'
import { Building2 } from 'lucide-react'
import { createDepositorAction, updateDepositorAction } from '../actions'
import type { DepositorRow } from '../actions'

const t = ptBR.admin.depositors

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

  function openCreate() {
    setForm(EMPTY_FORM)
    setEditingRow(null)
    setError(null)
    setModalMode('create')
  }

  function openEdit(d: DepositorRow) {
    setForm({ cnpj: d.cnpj, razao_social: d.razao_social })
    setEditingRow(d)
    setError(null)
    setModalMode('edit')
  }

  function closeModal() {
    setModalMode(null)
    setEditingRow(null)
    setError(null)
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

  const canSave = form.razao_social.trim().length > 0 &&
    (modalMode === 'edit' || form.cnpj.replace(/\D/g, '').length === 14)

  return (
    <>
      <div className="flex justify-end">
        <Button onClick={openCreate} size="sm">
          {t.createBtn}
        </Button>
      </div>

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
                  <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{formatCnpj(d.cnpj)}</td>
                  <td className="px-4 py-2.5 font-medium text-foreground">{d.razao_social}</td>
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
                  <td className="px-4 py-2.5 text-right">
                    <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={() => openEdit(d)}>
                      {t.editBtn}
                    </Button>
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
    </>
  )
}

function formatCnpj(cnpj: string) {
  const d = cnpj.replace(/\D/g, '')
  if (d.length !== 14) return cnpj
  return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8,12)}-${d.slice(12)}`
}
