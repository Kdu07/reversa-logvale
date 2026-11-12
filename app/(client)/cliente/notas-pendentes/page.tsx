import { getPendingKeysAction } from './actions'
import { PendingKeysSection } from './components/pending-keys-list'
import { PageHeader } from '@/components/shared/page-header'
import { EmptyState } from '@/components/shared/empty-state'
import { FileCheck2 } from 'lucide-react'

export default async function PendingKeysPage() {
  const result = await getPendingKeysAction()

  return (
    <div className="space-y-6">
      <PageHeader
        title="NFs Pendentes"
        description="Devoluções recebidas sem a chave de acesso da NF de origem — informe os 44 dígitos da chave da NF de venda."
      />

      {'error' in result ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-6 text-center text-sm text-destructive">
          Erro ao carregar as pendências: {result.error}
        </div>
      ) : result.awaiting.length === 0 && result.decided.length === 0 ? (
        <EmptyState
          icon={FileCheck2}
          title="Nenhuma NF pendente"
          description="Todas as suas devoluções já têm a chave de acesso. Quando uma devolução for recebida sem ela, aparecerá aqui."
        />
      ) : (
        <>
          <div className="flex items-start gap-2.5 rounded-lg border border-info/30 bg-info/10 px-4 py-3 text-sm text-info">
            <span className="mt-0.5 shrink-0 text-base">ℹ</span>
            <span>
              A chave pendente não bloqueia a decisão da devolução nem interrompe o prazo de 72h —
              você pode decidir normalmente e informar a chave depois.
            </span>
          </div>

          <PendingKeysSection
            title="Aguardando decisão"
            description="Devoluções que ainda esperam a sua decisão."
            emptyText="Nenhuma devolução aguardando decisão está sem chave."
            rows={result.awaiting}
            truncated={result.awaitingTruncated}
          />

          <PendingKeysSection
            title="Decididas"
            description="Já decididas por você ou automaticamente após 72h — falta apenas a chave."
            emptyText="Nenhuma devolução decidida está sem chave."
            rows={result.decided}
            truncated={result.decidedTruncated}
          />
        </>
      )}
    </div>
  )
}
