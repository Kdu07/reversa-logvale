import { describe, it, expect } from 'vitest'
import { accessKeyCheckDigit } from '@/lib/access-key'
import {
  diffReturnEdit,
  normalizeReturnEdit,
  type ReturnEditCurrent,
  type ReturnEditInput,
} from '@/lib/return-edit'

/** Chave de 44 dígitos com DV válido, emitida pelo CNPJ dado. */
function makeKey(cnpj = '12345678000199', nnf = '000001234'): string {
  const first43 = `35${'2411'}${cnpj}55001${nnf}1${'12345678'}`
  return first43 + accessKeyCheckDigit(first43)
}

const CURRENT: ReturnEditCurrent = {
  rv:                  'RV-001',
  identifier_type:     'postal_code',
  access_key:          null,
  postal_code:         '01310100',
  logistics_code:      null,
  illegible_token:     null,
  item_count:          3,
  damaged_item_count:  0,
  depositor_id:        'dep-1',
  final_customer_name: 'FULANO',
}

const INPUT: ReturnEditInput = {
  rv:                'RV-001',
  identifierType:    'postal_code',
  accessKey:         null,
  postalCode:        '01310-100',
  logisticsCode:     null,
  itemCount:         3,
  damagedItemCount:  0,
  depositorId:       'dep-1',
  finalCustomerName: 'FULANO',
  restartDeadline:   null,
}

function ok(input: Partial<ReturnEditInput>, current: Partial<ReturnEditCurrent> = {}) {
  const res = normalizeReturnEdit({ ...INPUT, ...input }, { ...CURRENT, ...current })
  if ('error' in res) throw new Error(res.error)
  return res.patch
}

function err(input: Partial<ReturnEditInput>, current: Partial<ReturnEditCurrent> = {}) {
  const res = normalizeReturnEdit({ ...INPUT, ...input }, { ...CURRENT, ...current })
  if (!('error' in res)) throw new Error('esperava erro')
  return res.error
}

describe('normalizeReturnEdit', () => {
  it('sem mudanças devolve o mesmo estado (CEP normalizado)', () => {
    expect(ok({})).toEqual(CURRENT)
  })

  it('exige RV', () => {
    expect(err({ rv: '   ' })).toMatch(/RV/)
  })

  it('valida CEP com 8 dígitos', () => {
    expect(err({ postalCode: '123' })).toMatch(/CEP/)
  })

  it('troca para chave de acesso: exige DV válido e zera o CEP', () => {
    const key = makeKey()
    const patch = ok({ identifierType: 'access_key', accessKey: key })
    expect(patch).toMatchObject({ identifier_type: 'access_key', access_key: key, postal_code: null })

    const bad = key.slice(0, 43) + ((Number(key[43]) + 1) % 10)
    expect(err({ identifierType: 'access_key', accessKey: bad })).toMatch(/dígito verificador/)
    expect(err({ identifierType: 'access_key', accessKey: null })).toMatch(/chave/)
  })

  it('não revalida o DV de uma chave que não mudou', () => {
    const legacy = '1'.repeat(44)
    const patch = ok(
      { identifierType: 'access_key', accessKey: legacy },
      { identifier_type: 'access_key', access_key: legacy, postal_code: null },
    )
    expect(patch.access_key).toBe(legacy)
  })

  it('mantém a chave opcional em identificação por CEP', () => {
    const key = makeKey()
    expect(ok({ accessKey: key })).toMatchObject({ postal_code: '01310100', access_key: key })
  })

  it('ilegível mantém o token existente ou gera um novo', () => {
    expect(ok({ identifierType: 'illegible' }).illegible_token).toMatch(/^ILEG-/)
    expect(
      ok({ identifierType: 'illegible' }, { identifier_type: 'illegible', illegible_token: 'ILEG-ABC', postal_code: null })
        .illegible_token,
    ).toBe('ILEG-ABC')
  })

  it('código de logística é obrigatório nesse tipo', () => {
    expect(err({ identifierType: 'logistics_code', logisticsCode: ' ' })).toMatch(/Logística/)
    expect(ok({ identifierType: 'logistics_code', logisticsCode: ' LR123 ' })).toMatchObject({
      logistics_code: 'LR123', postal_code: null,
    })
  })

  it('caixa vazia força avariados = 0', () => {
    expect(ok({ itemCount: 0, damagedItemCount: 2 })).toMatchObject({ item_count: 0, damaged_item_count: 0 })
  })

  it('avariados entre 0 e a quantidade', () => {
    expect(err({ itemCount: 2, damagedItemCount: 3 })).toMatch(/avariados/)
    expect(ok({ itemCount: 5, damagedItemCount: 2 })).toMatchObject({ item_count: 5, damaged_item_count: 2 })
  })

  it('"não avaliado" só se já era assim', () => {
    expect(err({ damagedItemCount: null })).toMatch(/estado/)
    expect(ok({ damagedItemCount: null }, { damaged_item_count: null }).damaged_item_count).toBeNull()
  })

  it('cliente final e depositante vazios viram null', () => {
    expect(ok({ finalCustomerName: '  ', depositorId: '' })).toMatchObject({
      final_customer_name: null, depositor_id: null,
    })
  })
})

describe('diffReturnEdit', () => {
  const names = { 'dep-1': 'ACME', 'dep-2': 'BLACKSKULL' }

  it('sem diferenças → lista vazia', () => {
    expect(diffReturnEdit(CURRENT, { ...CURRENT }, names)).toEqual([])
  })

  it('descreve cada campo alterado de forma legível', () => {
    const after: ReturnEditCurrent = {
      ...CURRENT,
      rv:                  'RV-002',
      depositor_id:        'dep-2',
      item_count:          4,
      damaged_item_count:  1,
      final_customer_name: null,
    }
    expect(diffReturnEdit(CURRENT, after, names)).toEqual([
      { field: 'rv',             label: 'RV',             from: 'RV-001',        to: 'RV-002' },
      { field: 'depositor',      label: 'Depositante',    from: 'ACME',          to: 'BLACKSKULL' },
      { field: 'items',          label: 'Itens / estado', from: '3 itens · Bom', to: '4 itens · Avaria (1 de 4)' },
      { field: 'final_customer', label: 'Cliente final',  from: 'FULANO',        to: '—' },
    ])
  })

  it('identificação usa o mesmo rótulo das telas', () => {
    const key = makeKey()
    const [change] = diffReturnEdit(CURRENT, { ...CURRENT, access_key: key }, names)
    expect(change).toEqual({
      field: 'identifier', label: 'Identificação', from: 'CEP: 01310100', to: `CEP: 01310100 · Chave: ${key}`,
    })
  })

  it('caixa vazia', () => {
    const [change] = diffReturnEdit(CURRENT, { ...CURRENT, item_count: 0, damaged_item_count: 0 }, names)
    expect(change).toMatchObject({ field: 'items', to: 'Caixa vazia' })
  })
})
