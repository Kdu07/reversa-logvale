#!/usr/bin/env node
// =====================================================================
// LOGVALE — Bootstrap do usuário super (primeiro acesso)
//
// Cria o ÚNICO usuário inicial do sistema:
//   - auth user (sem senha, e-mail já confirmado)
//   - profile role='manager'
//   - gera o link de ATIVAÇÃO (primeiro acesso) e o imprime no terminal
//
// O usuário vira "super" porque o e-mail está em SUPER_ADMIN_EMAILS (env).
// Replica exatamente o fluxo de createUserAction (admin.generateLink +
// /auth/callback?token_hash=...), o mesmo usado em /admin/usuarios.
//
// USO:
//   1. Exporte as variáveis do projeto de PRODUÇÃO (ou rode com um .env):
//        NEXT_PUBLIC_SUPABASE_URL=https://ahmzfvsxthutumwfmhqx.supabase.co
//        SUPABASE_SERVICE_ROLE_KEY=<service_role do projeto remoto>
//        NEXT_PUBLIC_APP_URL=https://<dominio-de-producao>   # base do link!
//   2. node scripts/bootstrap-super.mjs cadusquaglia@gmail.com "Cadu Quaglia"
//
// O link gerado aponta para NEXT_PUBLIC_APP_URL. Se for localhost, só funciona
// rodando o app local; para o launch real use o domínio de produção.
// =====================================================================

import { createClient } from '@supabase/supabase-js'

const url        = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const appUrl     = process.env.NEXT_PUBLIC_APP_URL

const email = process.argv[2] || 'cadusquaglia@gmail.com'
const name  = process.argv[3] || 'Cadu Quaglia'

function fail(msg) {
  console.error(`\n❌ ${msg}\n`)
  process.exit(1)
}

if (!url || !serviceKey) fail('Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.')
if (!appUrl) fail('Defina NEXT_PUBLIC_APP_URL (base do link de ativação).')

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function main() {
  console.log(`\n→ Projeto: ${url}`)
  console.log(`→ E-mail:  ${email}`)
  console.log(`→ Base do link (APP_URL): ${appUrl}\n`)

  // 1. Criar (ou reaproveitar) o auth user
  let userId
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
  })
  if (createErr) {
    if (!/already.*registered|already exists/i.test(createErr.message)) {
      fail(`createUser: ${createErr.message}`)
    }
    // já existe → buscar id
    const { data: list, error: listErr } = await admin.auth.admin.listUsers({ perPage: 200 })
    if (listErr) fail(`listUsers: ${listErr.message}`)
    const found = list.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())
    if (!found) fail('Usuário já existe mas não foi encontrado no listUsers.')
    userId = found.id
    console.log('• auth user já existia — reutilizando.')
  } else {
    userId = created.user.id
    console.log('• auth user criado.')
  }

  // 2. Profile manager (upsert para idempotência)
  const { error: profErr } = await admin
    .from('profiles')
    .upsert({ id: userId, role: 'manager', full_name: name }, { onConflict: 'id' })
  if (profErr) fail(`profiles upsert: ${profErr.message}`)
  console.log("• profile role='manager' garantido.")

  // 3. Link de ativação (magiclink → token_hash → /auth/callback)
  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email,
    options: { redirectTo: `${appUrl}/auth/callback` },
  })
  if (linkErr) fail(`generateLink: ${linkErr.message}`)

  const tokenHash = linkData?.properties?.hashed_token
  if (!tokenHash) fail('hashed_token não retornado pelo generateLink.')

  const activationLink =
    `${appUrl}/auth/callback?token_hash=${encodeURIComponent(tokenHash)}&type=magiclink`

  console.log('\n=====================================================================')
  console.log('LINK DE ATIVAÇÃO (primeiro acesso) — válido por ~1h, uso único:')
  console.log(activationLink)
  console.log('=====================================================================\n')
  console.log('Lembrete: confirme SUPER_ADMIN_EMAILS=' + email + ' no ambiente do app.\n')
}

main().catch((e) => fail(e?.message || String(e)))
