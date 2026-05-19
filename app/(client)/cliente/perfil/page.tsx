import { getCurrentUser } from '@/lib/supabase/get-current-user'
import { createClient } from '@/lib/supabase/server'
import ProfileSignOut from './profile-sign-out'

export default async function ClientProfilePage() {
  const user     = await getCurrentUser()
  const supabase = createClient()

  const { data: deps } = await supabase
    .from('client_depositors')
    .select('depositors!depositor_id(cnpj, razao_social)')
    .eq('client_id', user.id)

  const depositors = (deps ?? []).map((d) => {
    const dep = d.depositors as unknown as { cnpj: string; razao_social: string } | null
    return dep
  }).filter(Boolean) as { cnpj: string; razao_social: string }[]

  return (
    <div className="container mx-auto px-4 max-w-2xl py-8 space-y-6">
      <h1 className="text-2xl font-bold text-primary">Meu Perfil</h1>

      <div className="rounded-lg border bg-card p-6 space-y-4">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Dados Pessoais</p>
        <InfoRow label="Nome" value={user.profile.full_name} />
        <InfoRow label="E-mail" value={user.email ?? '—'} />
        <InfoRow label="Telefone" value={user.profile.phone ?? '—'} />
      </div>

      <div className="rounded-lg border bg-card p-6 space-y-4">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Depositantes Vinculados
        </p>
        {depositors.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum depositante vinculado.</p>
        ) : (
          <ul className="space-y-2">
            {depositors.map((d) => (
              <li key={d.cnpj} className="flex items-center justify-between text-sm border rounded-md px-3 py-2">
                <span className="font-medium text-foreground">{d.razao_social}</span>
                <span className="font-mono text-xs text-muted-foreground">{formatCnpj(d.cnpj)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex justify-end">
        <ProfileSignOut />
      </div>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm border-b border-border pb-3 last:border-0 last:pb-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  )
}

function formatCnpj(cnpj: string) {
  const d = cnpj.replace(/\D/g, '')
  if (d.length !== 14) return cnpj
  return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8,12)}-${d.slice(12)}`
}
