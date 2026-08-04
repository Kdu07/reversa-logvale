import { getPendingInvoicesAction } from './actions'
import { PendingInvoicesList } from './components/pending-invoices-list'
import { PageHeader } from '@/components/shared/page-header'

export default async function PendingInvoicesPage() {
  const result = await getPendingInvoicesAction()

  return (
    <div className="space-y-6">
      <PageHeader
        title="NFs Pendentes"
        description="Devoluções recebidas sem a chave de acesso da NF — anexe o XML ou o DANFE para completar a documentação."
      />

      {'error' in result ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-6 text-center text-sm text-destructive">
          Erro ao carregar as pendências: {result.error}
        </div>
      ) : (
        <>
          <div className="flex items-start gap-2.5 rounded-lg border border-info/30 bg-info/10 px-4 py-3 text-sm text-info">
            <span className="mt-0.5 shrink-0 text-base">ℹ</span>
            <span>
              A NF pendente não bloqueia a decisão da devolução nem interrompe o prazo de 72h —
              você pode decidir normalmente e anexar a nota depois.
            </span>
          </div>

          {result.truncated && (
            <p className="text-sm text-muted-foreground">
              Mostrando as 100 pendências mais antigas. Anexe estas para ver as seguintes.
            </p>
          )}

          <PendingInvoicesList rows={result.rows} />
        </>
      )}
    </div>
  )
}
