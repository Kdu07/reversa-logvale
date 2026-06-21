// Validação de senha compartilhada entre client e server (primeiro acesso e
// redefinição). Regra atual: mínimo de 8 caracteres, sem exigência de
// complexidade. Mantida em um único lugar para não divergir.

export const PASSWORD_MIN_LENGTH = 8

/**
 * Retorna a mensagem de erro (pt-BR) quando a senha é inválida, ou `null` quando
 * é aceitável.
 */
export function validatePassword(password: string): string | null {
  if (!password || password.length < PASSWORD_MIN_LENGTH) {
    return `A senha deve ter no mínimo ${PASSWORD_MIN_LENGTH} caracteres`
  }
  return null
}

/** Açúcar booleano para checagens rápidas. */
export function isValidPassword(password: string): boolean {
  return validatePassword(password) === null
}
