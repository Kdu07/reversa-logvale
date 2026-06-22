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
  // NFEio — consulta de NF-e por chave de acesso. NFEIO_ACCESS_KEY é a API Key da empresa,
  // enviada no header `Authorization`. Ausente => integração desligada (XML/PDF ficam pendentes).
  nfeioApiKey:  process.env.NFEIO_ACCESS_KEY,
  nfeioBaseUrl: process.env.NFEIO_BASE_URL ?? 'https://nfe.api.nfe.io',
  nfeioEnabled: Boolean(process.env.NFEIO_ACCESS_KEY),
  // E-mail transacional via SMTP (Google Workspace) com OAuth2 / Service Account.
  // A service account "impersona" a caixa em gmailOAuthUser via Domain-Wide Delegation,
  // então não há senha/App Password (incompatível com Workspace sem verificação em 2 etapas).
  smtpHost:    process.env.SMTP_HOST,
  smtpPort:    process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 465,
  // Caixa impersonada (default: o próprio MAIL_FROM, se definido).
  gmailOAuthUser:   process.env.GMAIL_OAUTH_USER ?? process.env.SMTP_USER ?? process.env.MAIL_FROM,
  // client_id (Unique ID numérico) da service account = serviceClient do Nodemailer.
  googleSaClientId: process.env.GOOGLE_SA_CLIENT_ID,
  // private_key da service account; aceita `\n` literais vindos do .env / secrets.
  googleSaPrivateKey: process.env.GOOGLE_SA_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  mailFrom:    process.env.MAIL_FROM ?? process.env.RESEND_FROM_EMAIL ?? 'notificacoes@logvale.com.br',
  mailEnabled: Boolean(
    process.env.SMTP_HOST &&
    (process.env.GMAIL_OAUTH_USER ?? process.env.SMTP_USER ?? process.env.MAIL_FROM) &&
    process.env.GOOGLE_SA_CLIENT_ID &&
    process.env.GOOGLE_SA_PRIVATE_KEY,
  ),
} as const
