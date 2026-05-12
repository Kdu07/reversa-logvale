import { getCurrentUser } from '@/lib/supabase/get-current-user'

export default async function TratativasPage() {
  await getCurrentUser()
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-primary">Tratativas</h1>
      <div className="rounded-lg border bg-card p-6 text-center text-muted-foreground">
        <p>Lista de tratativas será implementada na Fase 4.</p>
      </div>
    </div>
  )
}
