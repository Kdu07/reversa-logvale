/**
 * "Produto não corresponde" (migration 024) — o produto que veio na caixa não
 * é o da NF. Regra compartilhada pelo recebimento (`createReturnAction`) e pela
 * edição (`normalizeReturnEdit`), espelhando a constraint `mismatch_consistency`.
 */

export const MISMATCH_DESCRIPTION_MAX = 500

export interface MismatchInput {
  count:       number
  description: string
}

/**
 * `null` = não é "não corresponde". Quando é: 1..itemCount itens e uma
 * descrição (aparada) de 1..500 caracteres do que veio na caixa.
 */
export function validateMismatch(
  itemCount: number,
  mismatch:  MismatchInput | null | undefined,
): { mismatch: MismatchInput | null } | { error: string } {
  if (!mismatch) return { mismatch: null }
  if (itemCount === 0) return { error: 'Caixa vazia não pode ter produto não correspondente.' }
  const { count } = mismatch
  if (!Number.isInteger(count) || count < 1 || count > itemCount) {
    return { error: 'Quantidade de itens que não correspondem inválida.' }
  }
  const description = (mismatch.description ?? '').trim()
  if (!description) return { error: 'Descreva o que veio na caixa.' }
  if (description.length > MISMATCH_DESCRIPTION_MAX) {
    return { error: `A descrição do que veio na caixa passa de ${MISMATCH_DESCRIPTION_MAX} caracteres.` }
  }
  return { mismatch: { count, description } }
}
