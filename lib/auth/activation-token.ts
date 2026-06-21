import { randomBytes, createHash } from 'node:crypto'
import { createAdminClient } from '@/lib/supabase/admin'

// Token de ativação próprio: vale até o uso (sem expiração por tempo), uso único.
// Guardamos apenas o hash (sha256) do segredo; o segredo plaintext só circula na
// URL do e-mail. Acesso exclusivamente via service role (admin client).

function hashSecret(secret: string): string {
  return createHash('sha256').update(secret).digest('hex')
}

/**
 * Gera um novo segredo de ativação para o usuário, invalidando quaisquer tokens
 * anteriores (reenvio derruba o link antigo). Retorna o segredo plaintext que
 * deve ser embutido na URL `/ativar?token=<segredo>`.
 */
export async function createActivationToken(userId: string): Promise<string> {
  const admin  = createAdminClient()
  const secret = randomBytes(32).toString('base64url')

  // Invalida tokens anteriores do mesmo usuário antes de inserir o novo.
  const { error: delErr } = await admin
    .from('activation_tokens')
    .delete()
    .eq('user_id', userId)
  if (delErr) throw delErr

  const { error: insErr } = await admin
    .from('activation_tokens')
    .insert({ token_hash: hashSecret(secret), user_id: userId })
  if (insErr) throw insErr

  return secret
}

/**
 * Valida um segredo de ativação. Retorna o `user_id` quando o token existe e
 * ainda não foi usado; caso contrário, `null`.
 */
export async function consumeActivationToken(secret: string): Promise<string | null> {
  if (!secret) return null
  const admin = createAdminClient()

  const { data, error } = await admin
    .from('activation_tokens')
    .select('user_id, used_at')
    .eq('token_hash', hashSecret(secret))
    .maybeSingle()

  if (error || !data || data.used_at) return null
  return data.user_id as string
}

/** Marca o token do usuário como usado (chamado ao concluir a ativação). */
export async function markActivationTokenUsed(userId: string): Promise<void> {
  const admin = createAdminClient()
  await admin
    .from('activation_tokens')
    .update({ used_at: new Date().toISOString() })
    .eq('user_id', userId)
    .is('used_at', null)
}
