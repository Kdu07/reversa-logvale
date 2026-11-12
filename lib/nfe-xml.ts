import { isValidAccessKey } from '@/lib/access-key'

/**
 * Chave de acesso (44 dígitos) da própria NF-e contida num XML (`nfeProc`/`NFe`).
 *
 * Usa só os lugares que identificam ESTA nota — o atributo `Id="NFe<chave>"` do
 * `<infNFe>` e o `<chNFe>` do protocolo. Nunca uma busca genérica por 44
 * dígitos: uma NF de devolução traz a NF de venda em `<refNFe>`, e pegá-la
 * trocaria a chave da devolução pela da origem.
 */
export function parseNfeAccessKey(xml: string): string | null {
  const candidates = [
    xml.match(/<infNFe\b[^>]*\bId\s*=\s*["']NFe(\d{44})["']/i)?.[1],
    xml.match(/<chNFe>\s*(\d{44})\s*<\/chNFe>/i)?.[1],
  ]
  return candidates.find((key): key is string => !!key && isValidAccessKey(key)) ?? null
}
