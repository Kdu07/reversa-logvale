import { redirect } from 'next/navigation'
import { getCurrentUserOrNull } from '@/lib/supabase/get-current-user'
import { ROLE_HOME } from '@/types'
import LoginForm from './login-form'

interface LoginPageProps {
  searchParams: { error?: string }
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const user = await getCurrentUserOrNull()

  if (user) {
    redirect(ROLE_HOME[user.profile.role])
  }

  const callbackError =
    searchParams.error === 'auth_callback_error'
      ? 'Erro ao processar o link de acesso. Tente novamente.'
      : undefined

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="w-full max-w-md px-6">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary rounded-xl mb-4">
            <span className="text-white font-bold text-2xl">L</span>
          </div>
          <h1 className="text-2xl font-bold text-primary">
            LOG<span className="text-accent">VALE</span>
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Gestão de Devoluções
          </p>
        </div>

        <LoginForm callbackError={callbackError} />
      </div>
    </div>
  )
}
