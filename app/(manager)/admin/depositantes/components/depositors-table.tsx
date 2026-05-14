'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ptBR } from '@/lib/i18n/pt-BR'
import { createDepositorAction, updateDepositorAction } from '../actions'
import type { DepositorRow } from '../actions'

const t = ptBR.admin.depositors

interface Props {
  rows:  DepositorRow[]
  total: number
}

interface FormState {
  cnpj:         string
  razao_social: string
}

const EMPTY_FORM: FormState = { cnpj: '', razao_social: '' }

export function DepositorsTable({ rows }: Props) {
  const [modalMode, setModalMode]         = useState<'create' | 'edit' | null>(null)
  const [editingRow, setEditingRow]       = useState<DepositorRow | null>(null)
  const [form, setForm]                   = useState<FormState>(EMPTY_FORM)
  const [error, setError]                 = useState<string | null>(null)
  const [isPending, startTransition]      = useTransition()

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
      <div className="flex items-center justify-between gap-3 mb-4">
        <h1 className="text-2xl font-bold text-primary">{t.title}</h1>
        <Button onClick={openCreate} className="bg-primary text-primary-foreground hover:bg-primary/90">
          {t.createBtn}
        </Button>
      </div>

      <div className="rounded-lg border bg-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-muted-foreground border-b bg-muted/30">
              <th className="px-4 py-3 font-medium">{t.colCnpj}</th>
              <th className="px-4 py-3 font-medium">{t.colName}</th>
              <th className="px-4 py-3 font-medium">{t.colClients}</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                  {ptBR.common.noResults}
                </td>
              </tr>
            )}
            {rows.map((d) => (
              <tr key={d.id} className="hover:bg-muted/20 transition-colors">
                <td className="px-4 py-3 font-mono text-xs">{formatCnpj(d.cnpj)}</td>
                <td className="px-4 py-3 font-medium text-foreground">{d.razao_social}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  {d.clientNames.length === 0
                    ? <span className="text-xs">—</span>
                    : (
                      <span className="text-xs">
                        {d.clientNames.slice(0, 3).join(', ')}
                        {d.clientNames.length > 3 && ` +${d.clientNames.length - 3}`}
                      </span>
                    )
                  }
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    onClick={() => openEdit(d)}
                    className="text-xs text-primary hover:underline"
                  >
                    {t.editBtn}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modalMode && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md flex flex-col">
            <div className="flex items-center justify-between p-5 border-b">
              <p className="font-semibold text-foreground">
                {modalMode === 'create' ? t.createTitle : t.editTitle}
              </p>
              <button type="button" onClick={closeModal} className="text-muted-foreground hover:text-foreground text-lg leading-none">✕</button>
            </div>

            <div className="p-5 space-y-4">
              <div className="space-y-1">
                <label className="block text-xs font-medium text-muted-foreground">{t.fieldCnpj}</label>
                <input
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
                  value={form.cnpj}
                  readOnly={modalMode === 'edit'}
                  disabled={modalMode === 'edit'}
                  maxLength={18}
                  onChange={(e) => setForm((f) => ({ ...f, cnpj: e.target.value }))}
                  placeholder="00000000000000"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-medium text-muted-foreground">{t.fieldName}</label>
                <input
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
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

            <div className="flex gap-3 p-5 border-t">
              <Button type="button" variant="outline" onClick={closeModal} className="flex-1" disabled={isPending}>
                {ptBR.common.cancel}
              </Button>
              <Button
                type="button"
                onClick={handleSave}
                disabled={isPending || !canSave}
                className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                {isPending ? t.saving : ptBR.common.save}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function formatCnpj(cnpj: string) {
  const d = cnpj.replace(/\D/g, '')
  if (d.length !== 14) return cnpj
  return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8,12)}-${d.slice(12)}`
}
