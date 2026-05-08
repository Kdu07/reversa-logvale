import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { getCurrentUserOrNull } from '@/lib/supabase/get-current-user'
import { createClient } from '@/lib/supabase/server'
import { ROLE_HOME } from '@/types'
import type { UserRole } from '@/types'
import TermsAcceptForm from './terms-accept-form'

export default async function AceiteTermosPage() {
  const user = await getCurrentUserOrNull()

  if (!user) {
    redirect('/login')
  }

  if (user.profile.terms_accepted_at) {
    redirect(ROLE_HOME[user.profile.role])
  }

  async function acceptTerms(formData: FormData) {
    'use server'

    const accepted = formData.get('terms') === 'on'
    if (!accepted) return

    const supabase = createClient()
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser()

    if (!authUser) redirect('/login')

    await supabase
      .from('profiles')
      .update({ terms_accepted_at: new Date().toISOString() })
      .eq('id', authUser.id)

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', authUser.id)
      .single()

    revalidatePath('/', 'layout')
    redirect(ROLE_HOME[(profile?.role ?? 'client') as UserRole])
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary rounded-xl mb-4">
            <span className="text-white font-bold text-2xl">L</span>
          </div>
          <h1 className="text-2xl font-bold text-primary">
            LOG<span className="text-accent">VALE</span>
          </h1>
        </div>
        <TermsAcceptForm action={acceptTerms} />
      </div>
    </div>
  )
}
