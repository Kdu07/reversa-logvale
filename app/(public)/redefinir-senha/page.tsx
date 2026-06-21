import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { getCurrentUserOrNull } from '@/lib/supabase/get-current-user'
import { createClient } from '@/lib/supabase/server'
import { validatePassword } from '@/lib/validation/password'
import { ROLE_HOME } from '@/types'
import LogvaleLogo from '@/components/shared/logvale-logo'
import SetPasswordForm, { type PasswordFormState } from '../primeiro-acesso/set-password-form'

export default async function RedefinirSenhaPage() {
  const user = await getCurrentUserOrNull()
  if (!user) redirect('/login')

  const role = user.profile.role

  async function resetPassword(_state: PasswordFormState, formData: FormData): Promise<PasswordFormState> {
    'use server'
    const password = formData.get('password') as string

    const pwdError = validatePassword(password)
    if (pwdError) return { error: pwdError }

    const supabase = createClient()
    const { data: { user: authUser } } = await supabase.auth.getUser()
    if (!authUser) redirect('/login')

    const { error: pwdErr } = await supabase.auth.updateUser({ password })
    if (pwdErr) return { error: 'Não foi possível redefinir a senha. Tente novamente.' }

    revalidatePath('/', 'layout')
    redirect(ROLE_HOME[role])
  }

  return (
    <div className="bg-mesh-hero min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-lg space-y-8">
        <div className="flex flex-col items-center gap-3">
          <LogvaleLogo variant="full" size="lg" />
        </div>
        <SetPasswordForm
          action={resetPassword}
          requireTerms={false}
          title="Redefinir senha"
          subtitle="Escolha uma nova senha para acessar sua conta."
          submitLabel="Salvar nova senha"
        />
      </div>
    </div>
  )
}
