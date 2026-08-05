import { describe, it, expect } from 'vitest'
import { formatDate, identifierLabel, xmlDownloadName } from '@/lib/format'

describe('formatDate', () => {
  it('formata data ISO para padrão pt-BR com dia, mês e ano', () => {
    const result = formatDate('2024-01-15T14:30:00.000Z')
    expect(result).toContain('15')
    expect(result).toContain('01')
    expect(result).toContain('2024')
  })

  it('inclui horas e minutos no resultado', () => {
    const result = formatDate('2024-06-20T09:05:00.000Z')
    expect(result).toMatch(/\d{2}:\d{2}/)
  })

  it('converte para o horário de Brasília, e não para o fuso do runtime', () => {
    // 14:30 UTC = 11:30 em São Paulo (-03:00)
    expect(formatDate('2024-01-15T14:30:00.000Z')).toContain('11:30')
    expect(formatDate('2024-06-20T09:05:00.000Z')).toContain('06:05')
  })

  it('vira o dia pelo fuso de Brasília', () => {
    // 01:00 UTC ainda é 22:00 do dia anterior em São Paulo
    const result = formatDate('2024-03-10T01:00:00.000Z')
    expect(result).toContain('09/03/2024')
    expect(result).toContain('22:00')
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
      logisticsCode:  null,
      illegibleToken: null,
    })
    expect(result).toBe('Chave: CHAVE-12345')
  })

  it('retorna label de CEP', () => {
    const result = identifierLabel({
      identifierType: 'postal_code',
      accessKey:      null,
      postalCode:     '01310-100',
      logisticsCode:  null,
      illegibleToken: null,
    })
    expect(result).toBe('CEP: 01310-100')
  })

  it('retorna label de Código de Logística Reversa', () => {
    const result = identifierLabel({
      identifierType: 'logistics_code',
      accessKey:      null,
      postalCode:     null,
      logisticsCode:  'CLR-987',
      illegibleToken: null,
    })
    expect(result).toBe('Cód. Logística Reversa: CLR-987')
  })

  it('retorna label de token ilegível', () => {
    const result = identifierLabel({
      identifierType: 'illegible',
      accessKey:      null,
      postalCode:     null,
      logisticsCode:  null,
      illegibleToken: 'TOK-XYZ',
    })
    expect(result).toBe('Ilegível: TOK-XYZ')
  })
})

describe('xmlDownloadName', () => {
  it('monta nome para a NF de devolução a partir do RV', () => {
    expect(xmlDownloadName('RV2024001', 'devolucao')).toBe('RV2024001-nf-devolucao.xml')
  })

  it('monta nome para a NF original', () => {
    expect(xmlDownloadName('RV2024001', 'original')).toBe('RV2024001-nf-original.xml')
  })

  it('sanitiza caracteres inseguros para Content-Disposition', () => {
    expect(xmlDownloadName('RV 2024/001', 'devolucao')).toBe('RV_2024_001-nf-devolucao.xml')
  })

  it('usa fallback quando o RV é vazio', () => {
    expect(xmlDownloadName('', 'original')).toBe('nf-nf-original.xml')
  })
})
