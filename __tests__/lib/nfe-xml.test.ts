import { describe, it, expect } from 'vitest'
import { parseNfeAccessKey } from '@/lib/nfe-xml'

// Chaves com DV válido
const RETURN_KEY = '52060433009911002506550120000007800267301615'
const ORIGIN_KEY = '35260712345678000195550010000123451234567898'

const nfeProc = (opts: { id?: string; chNFe?: string; refNFe?: string } = {}) => `<?xml version="1.0"?>
<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">
  <NFe><infNFe versao="4.00" Id="NFe${opts.id ?? RETURN_KEY}">
    <ide><finNFe>4</finNFe>${opts.refNFe ? `<NFref><refNFe>${opts.refNFe}</refNFe></NFref>` : ''}</ide>
  </infNFe></NFe>
  ${opts.chNFe ? `<protNFe><infProt><chNFe>${opts.chNFe}</chNFe></infProt></protNFe>` : ''}
</nfeProc>`

describe('parseNfeAccessKey', () => {
  it('lê a chave do atributo Id do infNFe', () => {
    expect(parseNfeAccessKey(nfeProc())).toBe(RETURN_KEY)
  })

  it('ignora a NF referenciada (refNFe) — numa devolução ela é a NF de venda', () => {
    expect(parseNfeAccessKey(nfeProc({ refNFe: ORIGIN_KEY }))).toBe(RETURN_KEY)
  })

  it('cai no chNFe do protocolo quando o Id não é válido', () => {
    const xml = nfeProc({ id: '1'.repeat(44), chNFe: RETURN_KEY })
    expect(parseNfeAccessKey(xml)).toBe(RETURN_KEY)
  })

  it('devolve null para XML sem chave ou com chave inválida', () => {
    expect(parseNfeAccessKey('<html>não é NF</html>')).toBeNull()
    expect(parseNfeAccessKey(nfeProc({ id: '1'.repeat(44) }))).toBeNull()
  })
})
