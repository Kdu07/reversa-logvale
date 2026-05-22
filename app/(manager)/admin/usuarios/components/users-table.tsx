'use client'

import { useEffect, useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { EmptyState } from '@/components/shared/empty-state'
import { ptBR } from '@/lib/i18n/pt-BR'
import { Users, ChevronLeft, ChevronRight } from 'lucide-react'
import {
  createUserAction,
  updateUserAction,
  toggleActiveAction,
  resendMagicLinkAction,
  exportUserDataAction,
  anonymizeUserAction,
} from '../actions'
import { createDepositorAction } from '@/app/(manager)/admin/depositantes/actions'
import type { UserRow, DepositorOption } from '../actions'
import type { UserRole } from '@/types'

const t = ptBR.admin.users
const ROLES: UserRole[] = ['operator', 'client', 'manager']
const PAGE_SIZE = 50
const ROLE_LABELS: Record<UserRole, string> = {
  operator: ptBR.roles.operator,
  client:   ptBR.roles.client,
  manager:  ptBR.roles.manager,
}

const ROLE_VARIANT: Record<UserRole, 'default' | 'secondary' | 'outline'> = {
  operator: 'default',
  client:   'secondary',
  manager:  'outline',
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
  const [currentPage, setCurrentPage] = useState(0)
  const [modalMode, setModalMode]     = useState<'create' | 'edit' | null>(null)
  const [editingUser, setEditingUser] = useState<UserRow | null>(null)
  const [form, setForm]               = useState<FormState>(EMPTY_FORM)
  const [error, setError]             = useState<string | null>(null)
  const [linkModal, setLinkModal]     = useState<{ email: string; link: string } | null>(null)
  const [anonymizeTarget, setAnonymizeTarget] = useState<UserRow | null>(null)
  const [anonCountdown, setAnonCountdown]     = useState(2)
  const [localDepositors, setLocalDepositors] = useState<DepositorOption[]>(depositors)
  const [newDep, setNewDep] = useState({ open: false, cnpj: '', razao_social: '', error: null as string | null, loading: false })
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    if (!anonymizeTarget || anonCountdown <= 0) return
    const id = setTimeout(() => setAnonCountdown((c) => c - 1), 1000)
    return () => clearTimeout(id)
  }, [anonymizeTarget, anonCountdown])

  const filtered   = roleFilter === 'all' ? users : users.filter((u) => u.role === roleFilter)
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paginated  = filtered.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE)

  function changeFilter(f: UserRole | 'all') {
    setRoleFilter(f)
    setCurrentPage(0)
  }

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

  async function handleCreateDepositor() {
    setNewDep((d) => ({ ...d, loading: true, error: null }))
    const result = await createDepositorAction({ cnpj: newDep.cnpj, razao_social: newDep.razao_social })
    if ('error' in result) {
      setNewDep((d) => ({ ...d, loading: false, error: result.error }))
      return
    }
    const created = { id: result.id, razao_social: result.razao_social }
    setLocalDepositors((prev) => [...prev, created])
    toggleDep(created.id)
    setNewDep({ open: false, cnpj: '', razao_social: '', error: null, loading: false })
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
    startTransition(async () => { await toggleActiveAction(u.id, !u.active) })
  }

  function handleResendLink(u: UserRow) {
    startTransition(async () => {
      const result = await resendMagicLinkAction(u.email)
      if ('error' in result) { setError(result.error); return }
      setLinkModal({ email: u.email, link: result.link })
    })
  }

  function handleExport(u: UserRow) {
    startTransition(async () => {
      const result = await exportUserDataAction(u.id)
      if ('error' in result) { setError(result.error); return }
      const a = document.createElement('a')
      a.href = `data:application/zip;base64,${result.base64}`
      a.download = result.filename
      a.click()
    })
  }

  function handleAnonymize(u: UserRow) {
    setAnonymizeTarget(u)
    setAnonCountdown(2)
  }

  function confirmAnonymize() {
    if (!anonymizeTarget) return
    const target = anonymizeTarget
    setAnonymizeTarget(null)
    startTransition(async () => {
      const result = await anonymizeUserAction(target.id)
      if ('error' in result) { setError(result.error); return }
    })
  }

  return (
    <>
      {/* Filtros de role */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex gap-1.5 flex-wrap">
          {(['all', ...ROLES] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => changeFilter(r)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ease-quint ${
                roleFilter === r
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-transparent text-muted-foreground border-border hover:border-primary/50 hover:text-foreground'
              }`}
            >
              {r === 'all' ? t.filterAll : ROLE_LABELS[r]}
            </button>
          ))}
        </div>
        <Button onClick={openCreate} size="sm" className="gap-2">
          {t.createBtn}
        </Button>
      </div>

      {/* Tabela */}
      {paginated.length === 0 ? (
        <EmptyState icon={Users} title="Nenhum usuário" description={ptBR.common.noResults} />
      ) : (
        <div className="rounded-lg border border-border overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b bg-muted/30">
                <th className="px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">{t.colName}</th>
                <th className="px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">{t.colEmail}</th>
                <th className="px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">{t.colRole}</th>
                <th className="px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">{t.colStatus}</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {paginated.map((u) => (
                <tr key={u.id} className="hover:bg-muted/30 transition-colors ease-quint">
                  <td className="px-4 py-2.5 font-medium text-foreground">{u.full_name}</td>
                  <td className="px-4 py-2.5 text-muted-foreground text-xs">{u.email}</td>
                  <td className="px-4 py-2.5">
                    <Badge variant={ROLE_VARIANT[u.role]} className="text-xs">
                      {ROLE_LABELS[u.role]}
                    </Badge>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`text-xs font-medium ${u.active ? 'text-success' : 'text-muted-foreground line-through'}`}>
                      {u.active ? t.active : t.inactive}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex gap-3 justify-end flex-wrap">
                      <button type="button" onClick={() => openEdit(u)} className="text-xs text-primary hover:underline">{t.editBtn}</button>
                      <button type="button" onClick={() => handleToggle(u)} disabled={isPending} className="text-xs text-muted-foreground hover:underline">
                        {u.active ? t.deactivateBtn : t.activateBtn}
                      </button>
                      <button type="button" onClick={() => handleResendLink(u)} disabled={isPending} className="text-xs text-muted-foreground hover:underline">{t.resendLinkBtn}</button>
                      <button type="button" onClick={() => handleExport(u)} disabled={isPending} className="text-xs text-muted-foreground hover:underline">Exportar dados</button>
                      {u.active && (
                        <button type="button" onClick={() => handleAnonymize(u)} disabled={isPending} className="text-xs text-destructive hover:underline">Anonimizar</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Paginação */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">{filtered.length} usuários · página {currentPage + 1} de {totalPages}</span>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setCurrentPage((p) => p - 1)} disabled={currentPage === 0} className="gap-1">
              <ChevronLeft className="h-4 w-4" /> Anterior
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => setCurrentPage((p) => p + 1)} disabled={currentPage >= totalPages - 1} className="gap-1">
              Próxima <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Modal criar/editar */}
      <Dialog open={!!modalMode} onOpenChange={(o) => !o && closeModal()}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{modalMode === 'create' ? t.createTitle : t.editTitle}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <Field label={t.fieldName}>
              <input
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                value={form.full_name}
                onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
              />
            </Field>

            {modalMode === 'create' && (
              <Field label={t.fieldEmail}>
                <input
                  type="email"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                />
              </Field>
            )}

            <Field label={t.fieldPhone}>
              <input
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              />
            </Field>

            <Field label={t.fieldRole}>
              <select
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                value={form.role}
                onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as UserRole }))}
              >
                {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
              </select>
            </Field>

            {form.role === 'client' && (
              <Field label={t.fieldDepositors}>
                <div className="space-y-2 max-h-40 overflow-y-auto rounded-md border border-input bg-background p-2">
                  {localDepositors.length === 0 && !newDep.open && (
                    <p className="text-xs text-muted-foreground p-1">Nenhum depositante cadastrado.</p>
                  )}
                  {localDepositors.map((d) => (
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
                {newDep.open ? (
                  <div className="mt-2 space-y-2 rounded-md border border-input p-3 bg-muted/20">
                    <input
                      placeholder="CNPJ (14 dígitos)"
                      value={newDep.cnpj}
                      onChange={(e) => setNewDep((d) => ({ ...d, cnpj: e.target.value }))}
                      className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                    <input
                      placeholder="Razão Social"
                      value={newDep.razao_social}
                      onChange={(e) => setNewDep((d) => ({ ...d, razao_social: e.target.value }))}
                      className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                    {newDep.error && <p className="text-xs text-destructive">{newDep.error}</p>}
                    <div className="flex gap-2">
                      <Button type="button" variant="outline" size="sm" className="flex-1" onClick={() => setNewDep({ open: false, cnpj: '', razao_social: '', error: null, loading: false })}>
                        Cancelar
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        className="flex-1"
                        onClick={handleCreateDepositor}
                        disabled={newDep.loading || !newDep.cnpj.trim() || !newDep.razao_social.trim()}
                      >
                        {newDep.loading ? 'Criando...' : 'Criar'}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <button type="button" onClick={() => setNewDep((d) => ({ ...d, open: true }))} className="mt-1 text-xs text-primary hover:underline">
                    + Novo depositante
                  </button>
                )}
              </Field>
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
            <Button
              type="button"
              onClick={handleSave}
              disabled={isPending || !form.full_name.trim() || (modalMode === 'create' && !form.email.trim())}
            >
              {isPending ? (modalMode === 'create' ? t.creating : t.saving) : ptBR.common.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Anonimização */}
      <Dialog open={!!anonymizeTarget} onOpenChange={(o) => !o && setAnonymizeTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Anonimizar usuário</DialogTitle>
            <DialogDescription>
              Você está prestes a anonimizar <strong>{anonymizeTarget?.full_name}</strong>.<br />
              Ação irreversível — dados pessoais serão apagados permanentemente. Os dados fiscais são mantidos por exigência legal.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setAnonymizeTarget(null)}>Cancelar</Button>
            <Button type="button" variant="destructive" onClick={confirmAnonymize} disabled={anonCountdown > 0}>
              {anonCountdown > 0 ? `Anonimizar (${anonCountdown}s)` : 'Anonimizar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Magic link */}
      <Dialog open={!!linkModal} onOpenChange={(o) => !o && setLinkModal(null)}>
        {linkModal && (
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{t.resendLinkBtn}</DialogTitle>
              <DialogDescription>
                {ptBR.admin.users.linkSentLabel} <strong>{linkModal.email}</strong>
              </DialogDescription>
            </DialogHeader>
            <div className="flex gap-2">
              <input
                readOnly
                value={linkModal.link}
                className="flex-1 rounded-md border border-input bg-muted px-3 py-2 text-xs font-mono focus:outline-none"
              />
              <Button type="button" variant="outline" onClick={() => navigator.clipboard.writeText(linkModal.link)}>
                Copiar
              </Button>
            </div>
            <DialogFooter>
              <Button type="button" onClick={() => setLinkModal(null)}>Fechar</Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  )
}
