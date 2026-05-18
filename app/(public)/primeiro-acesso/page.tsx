import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { getCurrentUserOrNull } from '@/lib/supabase/get-current-user'
import { createClient } from '@/lib/supabase/server'
import { ROLE_HOME } from '@/types'
import LogvaleLogo from '@/components/shared/logvale-logo'
import SetPasswordForm from './set-password-form'

export default async function PrimeiroAcessoPage() {
  const user = await getCurrentUserOrNull()
  if (!user) redirect('/login')
  if (user.profile.terms_accepted_at) redirect(ROLE_HOME[user.profile.role])

  const role = user.profile.role

  async function setupAccount(formData: FormData) {
    'use server'
    const password = formData.get('password') as string
    const accepted = formData.get('terms') === 'on'
    if (!password || !accepted || password.length < 8) return

    const supabase = createClient()
    const { data: { user: authUser } } = await supabase.auth.getUser()
    if (!authUser) redirect('/login')

    await supabase.auth.updateUser({ password })
    await supabase
      .from('profiles')
      .update({ terms_accepted_at: new Date().toISOString() })
      .eq('id', authUser.id)

    revalidatePath('/', 'layout')
    redirect(ROLE_HOME[role])
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-lg">
        <LogvaleLogo />
        <SetPasswordForm action={setupAccount} />
      </div>
    </div>
  )
}
