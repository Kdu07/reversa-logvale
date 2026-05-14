import { getCurrentUser } from '@/lib/supabase/get-current-user'
import { getTrativasAction } from './actions'
import { TrativasList } from './components/tratativas-list'

interface SearchParams {
  rv?:   string
  page?: string
}

export default async function TratativasPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  await getCurrentUser()

  const rv   = searchParams.rv ?? ''
  const page = Math.max(1, parseInt(searchParams.page ?? '1', 10) || 1)

  const result = await getTrativasAction({ rv: rv || undefined, page })

  return (
    <div className="space-y-6">
      {'error' in result ? (
        <div className="rounded-lg border bg-card p-6 text-center text-destructive text-sm">
          Erro ao carregar tratativas: {result.error}
        </div>
      ) : (
        <TrativasList
          rows={result.rows}
          total={result.total}
          currentRv={rv}
          currentPage={page}
        />
      )}
    </div>
  )
}
