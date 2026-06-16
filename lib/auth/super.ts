import type { AuthUser } from '@/types'

/**
 * Conta super: profile 'manager' cujo e-mail está na allowlist SUPER_ADMIN_EMAILS.
 * Tem acesso a todas as telas (admin + operador + cliente) com leitura e escrita.
 *
 * A allowlist é lida só no servidor — nunca expor a lista de e-mails ao client.
 * Para o client, passe apenas o booleano `isSuper(...)` como prop.
 */
function getSuperEmails(): string[] {
  return (process.env.SUPER_ADMIN_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
}

export function isSuperEmail(email: string | null | undefined): boolean {
  if (!email) return false
  return getSuperEmails().includes(email.toLowerCase())
}

export function isSuperUser(user: AuthUser): boolean {
  return isSuperEmail(user.email)
}
