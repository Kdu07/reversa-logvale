import { cn } from '@/lib/utils'

interface ItemConditionBadgeProps {
  itemCount:        number
  /** null = não avaliado (recebida antes da etapa existir) → não renderiza. */
  damagedItemCount: number | null
  /** Itens que não correspondem à NF (migration 024); null = não é o caso. */
  mismatchedItemCount?: number | null
  /** O que veio na caixa — vira o tooltip do selo "Não corresponde". */
  mismatchDescription?: string | null
  className?:       string
}

const BASE = 'inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-1.5 py-0 text-[10px] font-medium'

/** Selo do estado dos produtos no recebimento: "Bom", "Avaria n/N", "Não corresponde n/N" ou "Caixa vazia". */
export function ItemConditionBadge({
  itemCount, damagedItemCount, mismatchedItemCount, mismatchDescription, className,
}: ItemConditionBadgeProps) {
  if (itemCount === 0) {
    return (
      <span
        title="Caixa recebida vazia, sem itens"
        className={cn(BASE, 'border-slate-300 bg-slate-100 text-slate-700', className)}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-current" />
        Caixa vazia
      </span>
    )
  }
  if (mismatchedItemCount) {
    const what = `${mismatchedItemCount} de ${itemCount} ${itemCount === 1 ? 'item não corresponde' : 'itens não correspondem'} à NF`
    return (
      <span
        title={mismatchDescription ? `${what} — veio: ${mismatchDescription}` : what}
        className={cn(BASE, 'border-violet-300 bg-violet-100 text-violet-800', className)}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-current" />
        Não corresponde {mismatchedItemCount}/{itemCount}
      </span>
    )
  }
  if (damagedItemCount === null) return null

  const damaged = damagedItemCount > 0
  return (
    <span
      title={damaged
        ? `${damagedItemCount} de ${itemCount} ${itemCount === 1 ? 'item avariado' : 'itens avariados'}`
        : 'Produtos em bom estado'}
      className={cn(
        BASE,
        damaged
          ? 'border-amber-300 bg-amber-100 text-amber-800'
          : 'border-green-300 bg-green-100 text-green-800',
        className,
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {damaged ? `Avaria ${damagedItemCount}/${itemCount}` : 'Bom'}
    </span>
  )
}
