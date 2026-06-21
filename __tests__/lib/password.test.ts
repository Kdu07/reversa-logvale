import { describe, it, expect } from 'vitest'
import { validatePassword, isValidPassword, PASSWORD_MIN_LENGTH } from '@/lib/validation/password'

describe('validatePassword', () => {
  it('rejeita senha vazia', () => {
    expect(validatePassword('')).toMatch(/8 caracteres/)
  })

  it('rejeita senha com menos de 8 caracteres', () => {
    expect(validatePassword('1234567')).toMatch(/8 caracteres/)
  })

  it('aceita senha com exatamente 8 caracteres', () => {
    expect(validatePassword('12345678')).toBeNull()
  })

  it('aceita senha longa', () => {
    expect(validatePassword('uma-senha-bem-longa')).toBeNull()
  })

  it('PASSWORD_MIN_LENGTH é 8', () => {
    expect(PASSWORD_MIN_LENGTH).toBe(8)
  })

  it('isValidPassword reflete validatePassword', () => {
    expect(isValidPassword('1234567')).toBe(false)
    expect(isValidPassword('12345678')).toBe(true)
  })
})
