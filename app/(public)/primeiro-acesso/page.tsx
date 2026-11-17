import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { getCurrentUserOrNull } from '@/lib/supabase/get-current-user'
import { createClient } from '@/lib/supabase/server'
import { markActivationTokenUsed } from '@/lib/auth/activation-token'
import { validatePassword } from '@/lib/validation/password'
import { ROLE_HOME } from '@/types'
import LogvaleLogo from '@/components/shared/logvale-logo'
import SetPasswordForm, { type PasswordFormState } from './set-password-form'

export default async function PrimeiroAcessoPage() {
  const user = await getCurrentUserOrNull()
  if (!user) redirect('/login')
  if (user.profile.terms_accepted_at) redirect(ROLE_HOME[user.profile.role])

  const role = user.profile.role

  async function setupAccount(_state: PasswordFormState, formData: FormData): Promise<PasswordFormState> {
    'use server'
    const password = formData.get('password') as string
    const accepted = formData.get('terms') === 'on'

    const pwdError = validatePassword(password)
    if (pwdError) return { error: pwdError }
    if (!accepted) return { error: 'É necessário aceitar os termos para continuar.' }

    const supabase = createClient()
    const { data: { user: authUser } } = await supabase.auth.getUser()
    if (!authUser) redirect('/login')

    const { error: pwdErr } = await supabase.auth.updateUser({ password })
    if (pwdErr) return { error: 'Não foi possível definir a senha. Tente novamente.' }

    // Só grava o aceite se ainda não houver um: a migration 023 proíbe trocar uma
    // data já gravada, e um reenvio do formulário (duplo clique, aba antiga)
    // falharia aqui depois de a senha já ter sido trocada.
    const { error: termsErr } = await supabase
      .from('profiles')
      .update({ terms_accepted_at: new Date().toISOString() })
      .eq('id', authUser.id)
      .is('terms_accepted_at', null)
    if (termsErr) return { error: 'Não foi possível concluir a ativação. Tente novamente.' }

    // Ativação concluída → encerra o token de ativação (uso único).
    await markActivationTokenUsed(authUser.id)

    revalidatePath('/', 'layout')
    redirect(ROLE_HOME[role])
  }

  return (
    <div className="bg-mesh-hero min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-lg space-y-8">
        <div className="flex flex-col items-center gap-3">
          <LogvaleLogo variant="full" size="lg" />
        </div>
        <SetPasswordForm action={setupAccount} />
      </div>
    </div>
  )
}
