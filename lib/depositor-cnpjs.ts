/**
 * CNPJs de um depositante (migration 026) — utilitários puros, seguros no client.
 *
 * Um depositante pode emitir NF por mais de um CNPJ. `depositors.cnpj` é o
 * principal; `depositor_cnpjs` guarda todos (o principal inclusive). Toda
 * comparação com o CNPJ emitente da chave de acesso deve aceitar qualquer um.
 */

/** Mantém só os dígitos — o CNPJ costuma vir com máscara. */
export function normalizeCnpj(value: string): string {
  return value.replace(/\D/g, '')
}

/** 00.000.000/0000-00 — devolve o valor original se não tiver 14 dígitos. */
export function formatCnpj(cnpj: string): string {
  const d = normalizeCnpj(cnpj)
  if (d.length !== 14) return cnpj
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`
}

export interface DepositorCnpjSource {
  cnpj:             string | null | undefined
  depositor_cnpjs?: { cnpj: string }[] | null
}

/**
 * Todos os CNPJs do depositante, principal primeiro e sem repetição. Sem o
 * embed de `depositor_cnpjs`, só o principal.
 */
export function depositorCnpjs(dep: DepositorCnpjSource | null | undefined): string[] {
  if (!dep) return []
  const all = [dep.cnpj, ...(dep.depositor_cnpjs ?? []).map((c) => c.cnpj)]
    .filter((c): c is string => !!c)
    .map(normalizeCnpj)
  return Array.from(new Set(all))
}

/** CNPJs além do principal, na ordem em que vieram. */
export function extraDepositorCnpjs(dep: DepositorCnpjSource | null | undefined): string[] {
  const principal = dep?.cnpj ? normalizeCnpj(dep.cnpj) : null
  return depositorCnpjs(dep).filter((c) => c !== principal)
}
