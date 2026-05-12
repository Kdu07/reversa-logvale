import { getCurrentUser } from '@/lib/supabase/get-current-user'
import { ReceivingFlow } from './receiving-flow'

export default async function RecebimentoPage() {
  const user = await getCurrentUser()
  return <ReceivingFlow receivedBy={user.id} operatorName={user.profile.full_name} />
}
