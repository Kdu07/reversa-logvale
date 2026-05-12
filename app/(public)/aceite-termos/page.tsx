import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { getCurrentUserOrNull } from '@/lib/supabase/get-current-user'
import { createClient } from '@/lib/supabase/server'
import { ROLE_HOME } from '@/types'
import LogvaleLogo from '@/components/shared/logvale-logo'
import TermsAcceptForm from './terms-accept-form'

export default async function AceiteTermosPage() {
  const user = await getCurrentUserOrNull()
  if (!user) redirect('/login')
  if (user.profile.terms_accepted_at) redirect(ROLE_HOME[user.profile.role])

  const role = user.profile.role

  async function acceptTerms(formData: FormData) {
    'use server'
    const accepted = formData.get('terms') === 'on'
    if (!accepted) return
    const supabase = createClient()
    const { data: { user: authUser } } = await supabase.auth.getUser()
    if (!authUser) redirect('/login')
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
        <TermsAcceptForm action={acceptTerms} />
      </div>
    </div>
  )
}
