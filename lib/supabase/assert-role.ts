import { getCurrentUser } from '@/lib/supabase/get-current-user'

export async function assertManager(): Promise<void> {
  const user = await getCurrentUser()
  if (user.profile.role !== 'manager') throw new Error('Acesso negado')
}
