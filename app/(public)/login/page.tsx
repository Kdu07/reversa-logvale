import { redirect } from 'next/navigation'
import { getCurrentUserOrNull } from '@/lib/supabase/get-current-user'
import { ROLE_HOME } from '@/types'
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
      ? 'Erro ao processar o link de acesso. Tente novamente.'
      : undefined

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="w-full max-w-md px-6">
        <LogvaleLogo subtitle="Gestão de Devoluções" />
        <LoginForm callbackError={callbackError} />
      </div>
    </div>
  )
}
