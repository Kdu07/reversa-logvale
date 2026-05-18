import { describe, it, expect } from 'vitest'
import { formatDate, identifierLabel } from '@/lib/format'

describe('formatDate', () => {
  it('formata data ISO para padrão pt-BR com dia, mês e ano', () => {
    const result = formatDate('2024-01-15T14:30:00.000Z')
    expect(result).toContain('15')
    expect(result).toContain('01')
    expect(result).toContain('2024')
  })

  it('inclui horas e minutos no resultado', () => {
    const result = formatDate('2024-06-20T09:05:00.000Z')
    // horário pode variar por timezone, mas deve ter formato HH:MM
    expect(result).toMatch(/\d{2}:\d{2}/)
  })

  it('retorna string não-vazia para qualquer data ISO válida', () => {
    const result = formatDate('2023-12-31T23:59:59.000Z')
    expect(result.length).toBeGreaterThan(0)
  })
})

describe('identifierLabel', () => {
  it('retorna label de chave de acesso', () => {
    const result = identifierLabel({
      identifierType: 'access_key',
      accessKey:      'CHAVE-12345',
      postalCode:     null,
      illegibleToken: null,
    })
    expect(result).toBe('Chave: CHAVE-12345')
  })

  it('retorna label de CEP', () => {
    const result = identifierLabel({
      identifierType: 'postal_code',
      accessKey:      null,
      postalCode:     '01310-100',
      illegibleToken: null,
    })
    expect(result).toBe('CEP: 01310-100')
  })

  it('retorna label de token ilegível', () => {
    const result = identifierLabel({
      identifierType: 'illegible',
      accessKey:      null,
      postalCode:     null,
      illegibleToken: 'TOK-XYZ',
    })
    expect(result).toBe('Ilegível: TOK-XYZ')
  })
})
