import { getCurrentUser } from '@/lib/supabase/get-current-user'
import { ptBR } from '@/lib/i18n/pt-BR'

export default async function ManagerDashboardPage() {
  const user = await getCurrentUser()

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-primary">
        {ptBR.nav.manager.dashboard}
      </h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {['Devoluções Hoje', 'Pendentes de Decisão', 'Tempo Médio de Decisão', 'Taxa de Auto-decisões'].map(
          (label) => (
            <div key={label} className="rounded-lg border bg-card p-4 space-y-1">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="text-2xl font-bold text-primary">—</p>
            </div>
          )
        )}
      </div>

      <div className="rounded-lg border bg-card p-6 text-center text-muted-foreground">
        <p>Dashboard completo será implementado na Fase 5.</p>
        <p className="text-sm mt-1">Usuário: {user.profile.full_name}</p>
      </div>
    </div>
  )
}
