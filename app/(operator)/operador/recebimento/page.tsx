import { getCurrentUser } from '@/lib/supabase/get-current-user'
import { ReceivingFlow } from './receiving-flow'

export default async function RecebimentoPage() {
  const user = await getCurrentUser()
  return <ReceivingFlow operatorName={user.profile.full_name} />
}
