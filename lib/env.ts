const required = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
] as const

const serverOnly = [
  'SUPABASE_SERVICE_ROLE_KEY',
  'NEXT_PUBLIC_APP_URL',
] as const

function validateEnv() {
  const missing: string[] = []

  for (const key of required) {
    if (!process.env[key]) missing.push(key)
  }

  if (typeof window === 'undefined') {
    for (const key of serverOnly) {
      if (!process.env[key]) missing.push(key)
    }
  }

  if (missing.length > 0) {
    const msg =
      `[Logvale] Variáveis de ambiente obrigatórias não configuradas:\n` +
      missing.map((v) => `  - ${v}`).join('\n') +
      `\n\nCopie .env.example para .env.local e preencha os valores.`

    if (process.env.NODE_ENV === 'production') {
      throw new Error(msg)
    } else {
      console.warn(`\n⚠️  ${msg}\n`)
    }
  }
}

validateEnv()

export const env = {
  supabaseUrl:            process.env.NEXT_PUBLIC_SUPABASE_URL!,
  supabaseAnonKey:        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
  appUrl:                 process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
  // Webmania — 4 credenciais OAuth (opcionais; dev mock ativo quando ausentes)
  webmaniaConsumerKey:        process.env.WEBMANIA_CONSUMER_KEY,
  webmaniaConsumerSecret:     process.env.WEBMANIA_CONSUMER_SECRET,
  webmaniaAccessToken:        process.env.WEBMANIA_ACCESS_TOKEN,
  webmaniaAccessTokenSecret:  process.env.WEBMANIA_ACCESS_TOKEN_SECRET,
  webmaniaBaseUrl:            process.env.WEBMANIA_BASE_URL ?? 'https://webmania.com.br/api',
  resendApiKey:   process.env.RESEND_API_KEY,
  resendFrom:     process.env.RESEND_FROM_EMAIL ?? 'notificacoes@logvale.com.br',
} as const
