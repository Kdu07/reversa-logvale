import Link from 'next/link'
import { getCurrentUser } from '@/lib/supabase/get-current-user'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ptBR } from '@/lib/i18n/pt-BR'

export default async function OperatorHomePage() {
  const user = await getCurrentUser()

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-primary">
        Olá, {user.profile.full_name}
      </h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link href="/operador/recebimento">
          <Card className="cursor-pointer hover:shadow-md transition-shadow border-primary/20 hover:border-primary/40">
            <CardHeader>
              <CardTitle className="text-primary text-lg">
                {ptBR.nav.operator.receiving}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-sm">
                Registrar nova devolução recebida em 7 etapas.
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/operador/tratativas">
          <Card className="cursor-pointer hover:shadow-md transition-shadow border-primary/20 hover:border-primary/40">
            <CardHeader>
              <CardTitle className="text-primary text-lg">
                {ptBR.nav.operator.handling}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-sm">
                Ver devoluções com decisão pendente de tratativa.
              </p>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  )
}
