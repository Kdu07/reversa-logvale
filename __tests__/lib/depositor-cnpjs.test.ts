import { describe, it, expect } from 'vitest'
import {
  depositorCnpjs,
  extraDepositorCnpjs,
  formatCnpj,
  normalizeCnpj,
} from '@/lib/depositor-cnpjs'

describe('normalizeCnpj', () => {
  it('mantém só os dígitos', () => {
    expect(normalizeCnpj('12.345.678/0001-95')).toBe('12345678000195')
    expect(normalizeCnpj(' 12345678000195 ')).toBe('12345678000195')
  })
})

describe('formatCnpj', () => {
  it('aplica a máscara em 14 dígitos', () => {
    expect(formatCnpj('12345678000195')).toBe('12.345.678/0001-95')
  })

  it('devolve o valor original se não tiver 14 dígitos', () => {
    expect(formatCnpj('123')).toBe('123')
  })
})

describe('depositorCnpjs', () => {
  it('principal primeiro, sem repetir o que já está no embed', () => {
    expect(depositorCnpjs({
      cnpj: '12345678000195',
      depositor_cnpjs: [{ cnpj: '98765432000110' }, { cnpj: '12345678000195' }],
    })).toEqual(['12345678000195', '98765432000110'])
  })

  it('sem o embed, só o principal', () => {
    expect(depositorCnpjs({ cnpj: '12345678000195' })).toEqual(['12345678000195'])
    expect(depositorCnpjs({ cnpj: '12345678000195', depositor_cnpjs: null })).toEqual(['12345678000195'])
  })

  it('depositante ausente → lista vazia', () => {
    expect(depositorCnpjs(null)).toEqual([])
    expect(depositorCnpjs(undefined)).toEqual([])
  })

  it('normaliza CNPJs com máscara', () => {
    expect(depositorCnpjs({ cnpj: '12.345.678/0001-95' })).toEqual(['12345678000195'])
  })
})

describe('extraDepositorCnpjs', () => {
  it('só os adicionais, sem o principal', () => {
    expect(extraDepositorCnpjs({
      cnpj: '12345678000195',
      depositor_cnpjs: [{ cnpj: '12345678000195' }, { cnpj: '98765432000110' }],
    })).toEqual(['98765432000110'])
  })

  it('nenhum adicional → lista vazia', () => {
    expect(extraDepositorCnpjs({ cnpj: '12345678000195', depositor_cnpjs: [{ cnpj: '12345678000195' }] })).toEqual([])
    expect(extraDepositorCnpjs(null)).toEqual([])
  })
})
