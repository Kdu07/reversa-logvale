import { describe, it, expect } from 'vitest'
import {
  normalizeAccessKey, accessKeyCheckDigit, isValidAccessKey, accessKeyEmitterCnpj,
  accessKeyInvoiceNumber,
} from '@/lib/access-key'

// Exemplo do Manual de Orientação do Contribuinte (SEFAZ) — DV 5
const MANUAL_KEY = '52060433009911002506550120000007800267301615'
// Montada para os testes: CNPJ 12345678000195, DV 8
const ACME_KEY   = '35260712345678000195550010000123451234567898'

describe('normalizeAccessKey', () => {
  it('mantém só os dígitos', () => {
    expect(normalizeAccessKey('3526 0712.3456-7800')).toBe('3526071234567800')
  })
})

describe('accessKeyCheckDigit', () => {
  it('confere com o exemplo do manual da SEFAZ', () => {
    expect(accessKeyCheckDigit(MANUAL_KEY.slice(0, 43))).toBe(5)
  })

  it('usa 0 quando o resto é 0 ou 1', () => {
    // 43 zeros: soma 0 → resto 0 → DV 0
    expect(accessKeyCheckDigit('0'.repeat(43))).toBe(0)
  })
})

describe('isValidAccessKey', () => {
  it('aceita chave de 44 dígitos com DV correto', () => {
    expect(isValidAccessKey(MANUAL_KEY)).toBe(true)
    expect(isValidAccessKey(ACME_KEY)).toBe(true)
  })

  it('recusa DV errado (erro de digitação)', () => {
    expect(isValidAccessKey(MANUAL_KEY.slice(0, 43) + '6')).toBe(false)
  })

  it('recusa tamanho diferente de 44 ou caracteres não numéricos', () => {
    expect(isValidAccessKey(MANUAL_KEY.slice(0, 43))).toBe(false)
    expect(isValidAccessKey(`${MANUAL_KEY.slice(0, 43)}x`)).toBe(false)
  })
})

describe('accessKeyEmitterCnpj', () => {
  it('extrai o CNPJ do emitente (posições 7–20)', () => {
    expect(accessKeyEmitterCnpj(ACME_KEY)).toBe('12345678000195')
    expect(accessKeyEmitterCnpj(MANUAL_KEY)).toBe('33009911002506')
  })
})

describe('accessKeyInvoiceNumber', () => {
  it('extrai o número da NF (posições 26–34) sem zeros à esquerda', () => {
    expect(accessKeyInvoiceNumber(ACME_KEY)).toBe('12345')
    expect(accessKeyInvoiceNumber(MANUAL_KEY)).toBe('780')
  })

  it('devolve null sem chave ou com chave fora do formato', () => {
    expect(accessKeyInvoiceNumber(null)).toBeNull()
    expect(accessKeyInvoiceNumber(undefined)).toBeNull()
    expect(accessKeyInvoiceNumber('')).toBeNull()
    expect(accessKeyInvoiceNumber(MANUAL_KEY.slice(0, 43))).toBeNull()
  })
})
