'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function ProfileSignOut() {
  const router = useRouter()

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <button
      type="button"
      onClick={handleSignOut}
      className="px-4 py-2 rounded-md border border-destructive text-destructive text-sm font-medium hover:bg-destructive/10 transition-colors"
    >
      Sair da conta
    </button>
  )
}
