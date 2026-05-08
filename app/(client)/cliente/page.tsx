import { getCurrentUser } from '@/lib/supabase/get-current-user'
import { ptBR } from '@/lib/i18n/pt-BR'

export default async function ClientHomePage() {
  const user = await getCurrentUser()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-primary">
          {ptBR.nav.client.home}
        </h1>
      </div>

      <div className="rounded-lg border bg-card p-6 text-center text-muted-foreground">
        <p>Tabela de devoluções pendentes será implementada na Fase 3.</p>
        <p className="text-sm mt-1">Usuário: {user.profile.full_name}</p>
      </div>
    </div>
  )
}
