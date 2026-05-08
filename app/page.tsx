import { redirect } from 'next/navigation'
import { getCurrentUserOrNull } from '@/lib/supabase/get-current-user'
import { ROLE_HOME } from '@/types'

export default async function RootPage() {
  const user = await getCurrentUserOrNull()

  if (!user) {
    redirect('/login')
  }

  redirect(ROLE_HOME[user.profile.role])
}
