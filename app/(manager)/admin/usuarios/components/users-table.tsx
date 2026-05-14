'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ptBR } from '@/lib/i18n/pt-BR'
import {
  createUserAction,
  updateUserAction,
  toggleActiveAction,
  resendMagicLinkAction,
} from '../actions'
import type { UserRow, DepositorOption } from '../actions'
import type { UserRole } from '@/types'

const t = ptBR.admin.users
const ROLES: UserRole[] = ['operator', 'client', 'manager']
const ROLE_LABELS: Record<UserRole, string> = {
  operator: ptBR.roles.operator,
  client:   ptBR.roles.client,
  manager:  ptBR.roles.manager,
}

interface Props {
  users:      UserRow[]
  depositors: DepositorOption[]
}

interface FormState {
  full_name:    string
  email:        string
  phone:        string
  role:         UserRole
  depositorIds: string[]
}

const EMPTY_FORM: FormState = {
  full_name: '', email: '', phone: '', role: 'client', depositorIds: [],
}

export function UsersTable({ users, depositors }: Props) {
  const [roleFilter, setRoleFilter]   = useState<UserRole | 'all'>('all')
  const [modalMode, setModalMode]     = useState<'create' | 'edit' | null>(null)
  const [editingUser, setEditingUser] = useState<UserRow | null>(null)
  const [form, setForm]               = useState<FormState>(EMPTY_FORM)
  const [error, setError]             = useState<string | null>(null)
  const [linkModal, setLinkModal]     = useState<{ email: string; link: string } | null>(null)
  const [isPending, startTransition]  = useTransition()

  const filtered = roleFilter === 'all' ? users : users.filter((u) => u.role === roleFilter)

  function openCreate() {
    setForm(EMPTY_FORM)
    setEditingUser(null)
    setError(null)
    setModalMode('create')
  }

  function openEdit(u: UserRow) {
    setForm({
      full_name:    u.full_name,
      email:        u.email,
      phone:        u.phone ?? '',
      role:         u.role,
      depositorIds: u.depositorIds,
    })
    setEditingUser(u)
    setError(null)
    setModalMode('edit')
  }

  function closeModal() {
    setModalMode(null)
    setEditingUser(null)
    setError(null)
  }

  function toggleDep(id: string) {
    setForm((f) => ({
      ...f,
      depositorIds: f.depositorIds.includes(id)
        ? f.depositorIds.filter((d) => d !== id)
        : [...f.depositorIds, id],
    }))
  }

  function handleSave() {
    setError(null)
    startTransition(async () => {
      const result = modalMode === 'create'
        ? await createUserAction({
            email:        form.email.trim(),
            full_name:    form.full_name.trim(),
            phone:        form.phone.trim(),
            role:         form.role,
            depositorIds: form.depositorIds,
          })
        : await updateUserAction({
            id:           editingUser!.id,
            full_name:    form.full_name.trim(),
            phone:        form.phone.trim(),
            role:         form.role,
            depositorIds: form.depositorIds,
          })
      if ('error' in result) { setError(result.error); return }
      closeModal()
    })
  }

  function handleToggle(u: UserRow) {
    startTransition(async () => {
      await toggleActiveAction(u.id, !u.active)
    })
  }

  function handleResendLink(u: UserRow) {
    startTransition(async () => {
      const result = await resendMagicLinkAction(u.email)
      if ('error' in result) { setError(result.error); return }
      setLinkModal({ email: u.email, link: result.link })
    })
  }

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-4">
        <h1 className="text-2xl font-bold text-primary">{t.title}</h1>
        <Button onClick={openCreate} className="bg-primary text-primary-foreground hover:bg-primary/90">
          {t.createBtn}
        </Button>
      </div>

      {/* Role filter */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {(['all', ...ROLES] as const).map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setRoleFilter(r)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              roleFilter === r
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-transparent text-muted-foreground border-border hover:border-primary hover:text-primary'
            }`}
          >
            {r === 'all' ? t.filterAll : ROLE_LABELS[r]}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-muted-foreground border-b bg-muted/30">
              <th className="px-4 py-3 font-medium">{t.colName}</th>
              <th className="px-4 py-3 font-medium">{t.colEmail}</th>
              <th className="px-4 py-3 font-medium">{t.colRole}</th>
              <th className="px-4 py-3 font-medium">{t.colStatus}</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                  {ptBR.common.noResults}
                </td>
              </tr>
            )}
            {filtered.map((u) => (
              <tr key={u.id} className="hover:bg-muted/20 transition-colors">
                <td className="px-4 py-3 font-medium text-foreground">{u.full_name}</td>
                <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                <td className="px-4 py-3">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-muted border border-border">
                    {ROLE_LABELS[u.role]}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs font-medium ${u.active ? 'text-green-700' : 'text-muted-foreground line-through'}`}>
                    {u.active ? t.active : t.inactive}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2 justify-end flex-wrap">
                    <button
                      type="button"
                      onClick={() => openEdit(u)}
                      className="text-xs text-primary hover:underline"
                    >
                      {t.editBtn}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggle(u)}
                      disabled={isPending}
                      className="text-xs text-muted-foreground hover:underline"
                    >
                      {u.active ? t.deactivateBtn : t.activateBtn}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleResendLink(u)}
                      disabled={isPending}
                      className="text-xs text-muted-foreground hover:underline"
                    >
                      {t.resendLinkBtn}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Create/Edit modal */}
      {modalMode && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b">
              <p className="font-semibold text-foreground">
                {modalMode === 'create' ? t.createTitle : t.editTitle}
              </p>
              <button type="button" onClick={closeModal} className="text-muted-foreground hover:text-foreground text-lg leading-none">✕</button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <Field label={t.fieldName}>
                <input
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  value={form.full_name}
                  onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
                />
              </Field>

              {modalMode === 'create' && (
                <Field label={t.fieldEmail}>
                  <input
                    type="email"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  />
                </Field>
              )}

              <Field label={t.fieldPhone}>
                <input
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                />
              </Field>

              <Field label={t.fieldRole}>
                <select
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  value={form.role}
                  onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as UserRole }))}
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                  ))}
                </select>
              </Field>

              {form.role === 'client' && (
                <Field label={t.fieldDepositors}>
                  <div className="space-y-2 max-h-40 overflow-y-auto rounded-md border border-input bg-background p-2">
                    {depositors.length === 0 && (
                      <p className="text-xs text-muted-foreground p-1">Nenhum depositante cadastrado.</p>
                    )}
                    {depositors.map((d) => (
                      <label key={d.id} className="flex items-center gap-2 cursor-pointer text-sm hover:bg-muted/30 px-1 py-0.5 rounded">
                        <input
                          type="checkbox"
                          checked={form.depositorIds.includes(d.id)}
                          onChange={() => toggleDep(d.id)}
                          className="accent-primary"
                        />
                        {d.razao_social}
                      </label>
                    ))}
                  </div>
                </Field>
              )}

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
                disabled={isPending || !form.full_name.trim() || (modalMode === 'create' && !form.email.trim())}
                className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                {isPending
                  ? (modalMode === 'create' ? t.creating : t.saving)
                  : ptBR.common.save}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Magic link modal */}
      {linkModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
            <p className="font-semibold text-foreground">{t.resendLinkBtn}</p>
            <p className="text-sm text-muted-foreground">{ptBR.admin.users.linkSentLabel} <strong>{linkModal.email}</strong></p>
            <div className="flex gap-2">
              <input
                readOnly
                value={linkModal.link}
                className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-xs font-mono focus:outline-none"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => navigator.clipboard.writeText(linkModal.link)}
              >
                Copiar
              </Button>
            </div>
            <Button
              type="button"
              onClick={() => setLinkModal(null)}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              Fechar
            </Button>
          </div>
        </div>
      )}
    </>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="block text-xs font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  )
}
