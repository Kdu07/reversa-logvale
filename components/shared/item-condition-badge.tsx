import { cn } from '@/lib/utils'

interface ItemConditionBadgeProps {
  itemCount:        number
  /** null = não avaliado (recebida antes da etapa existir) → não renderiza. */
  damagedItemCount: number | null
  className?:       string
}

/** Selo do estado dos produtos no recebimento: "Bom", "Avaria n/N" ou "Caixa vazia". */
export function ItemConditionBadge({ itemCount, damagedItemCount, className }: ItemConditionBadgeProps) {
  if (itemCount === 0) {
    return (
      <span
        title="Caixa recebida vazia, sem itens"
        className={cn(
          'inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-1.5 py-0 text-[10px] font-medium',
          'border-slate-300 bg-slate-100 text-slate-700',
          className,
        )}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-current" />
        Caixa vazia
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
        'inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-1.5 py-0 text-[10px] font-medium',
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
