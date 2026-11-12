/**
 * Chave de acesso da NF-e (44 dígitos) — utilitários puros, seguros no client.
 *
 * Layout (1-indexado): cUF(2) AAMM(4) CNPJ(14) mod(2) série(3) nNF(9) tpEmis(1) cNF(8) cDV(1)
 */

/** Mantém só os dígitos — a chave costuma ser colada com espaços ou pontos. */
export function normalizeAccessKey(value: string): string {
  return value.replace(/\D/g, '')
}

/**
 * Dígito verificador (módulo 11) dos 43 primeiros dígitos: pesos 2..9 da
 * direita para a esquerda; resto 0 ou 1 → DV 0, senão 11 − resto.
 */
export function accessKeyCheckDigit(first43: string): number {
  let sum    = 0
  let weight = 2
  for (let i = first43.length - 1; i >= 0; i--) {
    sum += Number(first43[i]) * weight
    weight = weight === 9 ? 2 : weight + 1
  }
  const rest = sum % 11
  return rest < 2 ? 0 : 11 - rest
}

/** 44 dígitos com DV válido — pega erro de digitação antes de gravar. */
export function isValidAccessKey(key: string): boolean {
  if (!/^\d{44}$/.test(key)) return false
  return accessKeyCheckDigit(key.slice(0, 43)) === Number(key[43])
}

/** CNPJ do emitente codificado na chave (posições 7–20). */
export function accessKeyEmitterCnpj(key: string): string {
  return key.slice(6, 20)
}
