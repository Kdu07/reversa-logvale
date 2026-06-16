import { redirect } from 'next/navigation'
import { getCurrentUserOrNull } from '@/lib/supabase/get-current-user'
import { ROLE_HOME } from '@/types'
import { ptBR } from '@/lib/i18n/pt-BR'
import LogvaleLogo from '@/components/shared/logvale-logo'
import LoginForm from './login-form'

interface LoginPageProps {
  searchParams: { error?: string }
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const user = await getCurrentUserOrNull()
  if (user) redirect(ROLE_HOME[user.profile.role])

  const callbackError =
    searchParams.error === 'auth_callback_error'
      ? ptBR.auth.login.callbackError
      : undefined

  return (
    <div className="bg-mesh-hero min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md space-y-8">
        <div className="flex flex-col items-center gap-3">
          <LogvaleLogo variant="full" size="lg" subtitle="Gestão de Devoluções" />
        </div>
        <LoginForm callbackError={callbackError} />
      </div>
    </div>
  )
}
