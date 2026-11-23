import { getCurrentUser } from '@/lib/supabase/get-current-user'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/shared/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import ProfileSignOut from './profile-sign-out'
import { depositorCnpjs, formatCnpj, type DepositorCnpjSource } from '@/lib/depositor-cnpjs'
import { User, Building2 } from 'lucide-react'

export default async function ClientProfilePage() {
  const user     = await getCurrentUser()
  const supabase = createClient()

  const { data: deps } = await supabase
    .from('client_depositors')
    .select('depositors!depositor_id(cnpj, razao_social, depositor_cnpjs(cnpj))')
    .eq('client_id', user.id)

  // Todos os CNPJs de cada depositante (principal primeiro) — migration 026.
  const depositors = (deps ?? []).flatMap((d) => {
    const dep = d.depositors as unknown as (DepositorCnpjSource & { cnpj: string; razao_social: string }) | null
    return dep ? [{ cnpj: dep.cnpj, razao_social: dep.razao_social, cnpjs: depositorCnpjs(dep) }] : []
  })

  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader title="Meu Perfil" description="Informações da sua conta." />

      <Card className="shadow-elev-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <User className="h-4 w-4 text-muted-foreground" />
            Dados Pessoais
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-0 divide-y divide-border">
          <InfoRow label="Nome"     value={user.profile.full_name} />
          <InfoRow label="E-mail"   value={user.email ?? '—'}      />
          <InfoRow label="Telefone" value={user.profile.phone ?? '—'} />
        </CardContent>
      </Card>

      <Card className="shadow-elev-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            Depositantes Vinculados
          </CardTitle>
        </CardHeader>
        <CardContent>
          {depositors.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum depositante vinculado.</p>
          ) : (
            <ul className="divide-y divide-border">
              {depositors.map((d) => (
                <li key={d.cnpj} className="flex items-start justify-between gap-4 py-2.5 text-sm first:pt-0 last:pb-0">
                  <span className="font-medium text-foreground">{d.razao_social}</span>
                  <span className="flex flex-col items-end font-mono text-xs text-muted-foreground">
                    {d.cnpjs.map((c) => <span key={c}>{formatCnpj(c)}</span>)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <ProfileSignOut />
      </div>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  )
}
