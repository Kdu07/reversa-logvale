import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  createDepositorAction,
  updateDepositorAction,
} from '@/app/(manager)/admin/depositantes/actions'

// assertManager usa getCurrentUser internamente
vi.mock('@/lib/supabase/get-current-user', () => ({
  getCurrentUser: vi.fn().mockResolvedValue({
    id:      'm-1',
    email:   'm@logvale.com',
    profile: { id: 'm-1', role: 'manager', active: true, full_name: 'Manager', phone: null, terms_accepted_at: '2024-01-01', created_at: '' },
  }),
}))

const mockSingle           = vi.fn()
const mockSelectAfterInsert = vi.fn().mockReturnValue({ single: mockSingle })
const mockInsert            = vi.fn().mockReturnValue({ select: mockSelectAfterInsert })
const mockEq                = vi.fn()
const mockUpdate            = vi.fn().mockReturnValue({ eq: mockEq })
const mockFrom              = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({ from: mockFrom })),
}))

beforeEach(() => {
  vi.clearAllMocks()
  mockSingle.mockResolvedValue({ data: { id: 'dep-new' }, error: null })
  mockSelectAfterInsert.mockReturnValue({ single: mockSingle })
  mockInsert.mockReturnValue({ select: mockSelectAfterInsert })
  mockEq.mockResolvedValue({ error: null })
  mockFrom.mockImplementation((table: string) => {
    if (table === 'depositors') return { insert: mockInsert, update: mockUpdate }
    return {}
  })
})

describe('createDepositorAction', () => {
  it('retorna erro para CNPJ com menos de 14 dígitos', async () => {
    const result = await createDepositorAction({ cnpj: '1234567800019', razao_social: 'Empresa X' })

    expect(result).toEqual({ error: 'CNPJ deve ter 14 dígitos' })
    expect(mockInsert).not.toHaveBeenCalled()
  })

  it('strip de máscara e valida CNPJ formatado (12.345.678/0001-99)', async () => {
    const result = await createDepositorAction({ cnpj: '12.345.678/0001-99', razao_social: 'Empresa Y' })

    // 12345678000199 tem 14 dígitos → deve inserir
    expect(result).toMatchObject({ ok: true })
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({ cnpj: '12345678000199' }),
    )
  })

  it('cria depositante com CNPJ válido e retorna {ok:true}', async () => {
    const result = await createDepositorAction({ cnpj: '12345678000195', razao_social: 'TechStore' })

    expect(result).toMatchObject({ ok: true })
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({ cnpj: '12345678000195', razao_social: 'TechStore' }),
    )
  })

  it('revalida /admin/depositantes após criação', async () => {
    const { revalidatePath } = await import('next/cache')

    await createDepositorAction({ cnpj: '12345678000195', razao_social: 'TechStore' })

    expect(revalidatePath).toHaveBeenCalledWith('/admin/depositantes')
  })

  it('retorna erro quando DB falha', async () => {
    mockSingle.mockResolvedValue({ data: null, error: new Error('unique_violation') })

    const result = await createDepositorAction({ cnpj: '12345678000195', razao_social: 'Dup' })

    expect(result).toEqual({ error: 'unique_violation' })
  })
})

describe('updateDepositorAction', () => {
  it('atualiza razao_social e retorna {ok:true}', async () => {
    const result = await updateDepositorAction({ id: 'dep-1', razao_social: 'Nova Razão Social' })

    expect(result).toEqual({ ok: true })
    expect(mockUpdate).toHaveBeenCalledWith({ razao_social: 'Nova Razão Social' })
    expect(mockEq).toHaveBeenCalledWith('id', 'dep-1')
  })

  it('revalida /admin/depositantes após atualização', async () => {
    const { revalidatePath } = await import('next/cache')

    await updateDepositorAction({ id: 'dep-1', razao_social: 'Razão Atualizada' })

    expect(revalidatePath).toHaveBeenCalledWith('/admin/depositantes')
  })

  it('retorna erro quando DB falha', async () => {
    mockEq.mockResolvedValue({ error: new Error('not found') })

    const result = await updateDepositorAction({ id: 'dep-xxx', razao_social: 'X' })

    expect(result).toEqual({ error: 'not found' })
  })
})
