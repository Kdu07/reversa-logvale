import Link from 'next/link'
import { getCurrentUser } from '@/lib/supabase/get-current-user'
import { PageHeader } from '@/components/shared/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { PackageCheck, ClipboardList, ArrowRight } from 'lucide-react'

export default async function OperatorHomePage() {
  const user = await getCurrentUser()
  const firstName = user.profile.full_name.split(' ')[0]

  return (
    <div className="space-y-8">
      <PageHeader
        title={`Olá, ${firstName}`}
        description="Escolha uma operação para começar."
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link href="/operador/recebimento" className="group">
          <Card className="h-full shadow-elev-sm hover:shadow-elev-md transition-all ease-quint border-border/50 hover:border-primary/30">
            <CardContent className="flex items-start gap-4 p-6">
              <div className="shrink-0 rounded-xl bg-gradient-primary p-3 text-primary-foreground shadow-elev-sm">
                <PackageCheck className="h-6 w-6" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-foreground group-hover:text-primary transition-colors ease-quint">
                  Novo Recebimento
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Registrar nova devolução recebida em 7 etapas.
                </p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground/50 group-hover:text-primary group-hover:translate-x-0.5 transition-all ease-quint shrink-0 mt-0.5" />
            </CardContent>
          </Card>
        </Link>

        <Link href="/operador/tratativas" className="group">
          <Card className="h-full shadow-elev-sm hover:shadow-elev-md transition-all ease-quint border-border/50 hover:border-primary/30">
            <CardContent className="flex items-start gap-4 p-6">
              <div className="shrink-0 rounded-xl bg-gradient-primary p-3 text-primary-foreground shadow-elev-sm">
                <ClipboardList className="h-6 w-6" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-foreground group-hover:text-primary transition-colors ease-quint">
                  Tratativas
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Ver devoluções com decisão pendente de tratativa.
                </p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground/50 group-hover:text-primary group-hover:translate-x-0.5 transition-all ease-quint shrink-0 mt-0.5" />
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  )
}
