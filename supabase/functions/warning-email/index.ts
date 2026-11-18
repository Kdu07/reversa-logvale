import { createClient } from 'npm:@supabase/supabase-js@2'
import nodemailer from 'npm:nodemailer@9.0.1'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

// Dois modos de envio, na mesma prioridade do app (lib/integrations/email.ts):
//
// 1. Senha de app — SMTP_USER + SMTP_PASS definidos: login SMTP direto (ex.:
//    uma conta @gmail.com pessoal, que a Domain-Wide Delegation não alcança).
//    Sempre na porta 465 (TLS implícito): o Supabase bloqueia a saída pelas
//    portas 25 e 587 nas Edge Functions, então SMTP_PORT não é lido aqui.
// 2. Service account — Gmail API REST com OAuth2 / Domain-Wide Delegation: a
//    service account impersona OAUTH_USER, sem senha. O issuer (iss) do JWT pode
//    ser o client_email OU o Unique ID numérico — o Google aceita ambos.
const SMTP_HOST       = Deno.env.get('SMTP_HOST') ?? 'smtp.gmail.com'
const SMTP_USER       = Deno.env.get('SMTP_USER')?.trim() || undefined
// A senha de app do Google é exibida com espaços ("abcd efgh ijkl mnop").
const SMTP_PASS       = Deno.env.get('SMTP_PASS')?.replace(/\s+/g, '') || undefined
const USE_APP_PASSWORD = Boolean(SMTP_USER && SMTP_PASS)

const SA_ISS          = Deno.env.get('GOOGLE_SA_CLIENT_EMAIL') ?? Deno.env.get('GOOGLE_SA_CLIENT_ID')!
const SA_PRIVATE_KEY  = (Deno.env.get('GOOGLE_SA_PRIVATE_KEY') ?? '').replace(/\\n/g, '\n')
const OAUTH_USER      = Deno.env.get('GMAIL_OAUTH_USER') ?? Deno.env.get('MAIL_FROM') ?? 'cadu@logvale.com.br'
// Com senha de app o Gmail reescreve um From diferente da conta logada, então o
// padrão é a própria conta.
const FROM            = Deno.env.get('MAIL_FROM') ?? (USE_APP_PASSWORD ? SMTP_USER! : OAUTH_USER)
const APP_URL         = Deno.env.get('NEXT_PUBLIC_APP_URL') ?? 'https://logvale.com.br'
// Tem de ser um escopo LIBERADO para o client ID na Domain-Wide Delegation do
// Google Admin. Lá só está `https://mail.google.com/` (o mesmo que o Nodemailer
// usa no app). `gmail.send` não está liberado → o Google responde 403
// "Requested client not authorized" e nenhum aviso sai (foi o que aconteceu de
// 2026-06 a 2026-11).
const GMAIL_SCOPE     = 'https://mail.google.com/'

interface WarningRow {
  id:          string
  rv:          string
  received_at: string
  client_id:   string
}

Deno.serve(async (_req) => {
  const { data: rows, error } = await supabase
    .from('returns_needing_warning')
    .select('id, rv, received_at, client_id')
    .limit(200)

  if (error) {
    console.error('[warning-email] query error:', error.message)
    return json({ sent: 0, error: error.message }, 500)
  }

  if (!rows || rows.length === 0) {
    console.log('[warning-email] nothing to send')
    return json({ sent: 0 })
  }

  // Agrupa por client_id para enviar 1 email por cliente
  const byClient = new Map<string, WarningRow[]>()
  for (const r of rows as WarningRow[]) {
    if (!byClient.has(r.client_id)) byClient.set(r.client_id, [])
    byClient.get(r.client_id)!.push(r)
  }

  // Autentica uma vez antes do laço: credencial errada vira um 500 claro
  // (`smtp_auth` / `oauth_token`) em vez de N falhas iguais.
  let send: (msg: Mail) => Promise<void>
  try {
    send = await createMailer()
  } catch (e) {
    const error = USE_APP_PASSWORD ? 'smtp_auth' : 'oauth_token'
    console.error(`[warning-email] ${error} error:`, e)
    return json({ sent: 0, error }, 500)
  }

  let sent   = 0
  let failed = 0
  for (const [clientId, clientRows] of byClient) {
    try {
      const { data: { user }, error: userErr } = await supabase.auth.admin.getUserById(clientId)
      if (userErr || !user?.email) {
        console.warn(`[warning-email] no email for client ${clientId}`)
        continue
      }

      const returns = clientRows.map((r) => ({ rv: r.rv, receivedAt: r.received_at }))
      const subject = `${returns.length} devolução${returns.length > 1 ? 'ões' : ''} pendente${returns.length > 1 ? 's' : ''} de decisão`

      await send({
        to:      user.email,
        subject,
        html:    buildHtml(returns, APP_URL),
      })

      const ids = clientRows.map((r) => r.id)
      await supabase
        .from('returns')
        .update({ warning_sent_at: new Date().toISOString() })
        .in('id', ids)

      console.log(`[warning-email] sent to ${user.email} (${ids.length} returns)`)
      sent++
    } catch (e) {
      failed++
      console.error(`[warning-email] failed for client ${clientId}:`, e)
    }
  }

  // Falha em algum envio → 500, para aparecer em net._http_response / logs em
  // vez de um 200 {"sent":0} que parece "fila vazia".
  return json({ sent, failed }, failed > 0 ? 500 : 200)
})

interface Mail {
  to:      string
  subject: string
  html:    string
}

/** Prepara o envio no modo configurado (senha de app tem prioridade). Lança se a autenticação falhar. */
async function createMailer(): Promise<(msg: Mail) => Promise<void>> {
  if (USE_APP_PASSWORD) {
    const transporter = nodemailer.createTransport({
      host:   SMTP_HOST,
      port:   465,
      secure: true,
      auth:   { user: SMTP_USER, pass: SMTP_PASS },
    })
    await transporter.verify() // login SMTP — 535 aqui = usuário/senha de app errados
    return async (msg) => {
      await transporter.sendMail({ from: FROM, to: msg.to, subject: msg.subject, html: msg.html })
    }
  }

  const token = await getAccessToken()
  return (msg) => sendGmail(token, msg)
}

/** base64url (sem padding) a partir de bytes ou string UTF-8. */
function base64url(input: Uint8Array | string): string {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : input
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** base64 padrão (com padding) — usado no corpo MIME e no encoded-word do assunto. */
function base64(input: Uint8Array | string): string {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : input
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin)
}

function pemToPkcs8(pem: string): Uint8Array {
  const b64 = pem
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s+/g, '')
  const bin = atob(b64)
  const der = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) der[i] = bin.charCodeAt(i)
  return der
}

/** Gera um access token via fluxo JWT bearer (service account impersonando OAUTH_USER). */
async function getAccessToken(): Promise<string> {
  const now    = Math.floor(Date.now() / 1000)
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const claim  = base64url(JSON.stringify({
    iss:   SA_ISS,
    sub:   OAUTH_USER,
    scope: GMAIL_SCOPE,
    aud:   'https://oauth2.googleapis.com/token',
    iat:   now,
    exp:   now + 3600,
  }))
  const unsigned = `${header}.${claim}`

  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToPkcs8(SA_PRIVATE_KEY),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    new TextEncoder().encode(unsigned),
  )
  const jwt = `${unsigned}.${base64url(new Uint8Array(sig))}`

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion:  jwt,
    }),
  })
  if (!res.ok) throw new Error(`token ${res.status}: ${await res.text()}`)
  const data = await res.json()
  return data.access_token as string
}

/** Envia um e-mail HTML pela Gmail API REST (users/me = a caixa impersonada). */
async function sendGmail(token: string, msg: Mail): Promise<void> {
  const body = base64(new TextEncoder().encode(msg.html)).replace(/(.{76})/g, '$1\r\n')
  const mime = [
    `From: ${FROM}`,
    `To: ${msg.to}`,
    `Subject: =?UTF-8?B?${base64(msg.subject)}?=`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    body,
  ].join('\r\n')

  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method:  'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body:    JSON.stringify({ raw: base64url(new TextEncoder().encode(mime)) }),
  })
  if (!res.ok) throw new Error(`gmail send ${res.status}: ${await res.text()}`)
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
    timeZone: 'America/Sao_Paulo',
  })
}

function buildHtml(returns: { rv: string; receivedAt: string }[], appUrl: string): string {
  const count = returns.length
  const rows  = returns.map((r) => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #f4f4f5;font-family:Arial,sans-serif;font-size:13px;color:#18181b;">${r.rv}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f4f4f5;font-family:Arial,sans-serif;font-size:13px;color:#71717a;">${formatDate(r.receivedAt)}</td>
    </tr>`).join('')

  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:#fff;border-radius:8px;overflow:hidden;">
    <div style="background:#08366D;padding:24px 40px;text-align:center;">
      <span style="font-size:28px;font-weight:700;letter-spacing:2px;color:#fff;">LOG<span style="color:#F12D46;">V</span>ALE</span>
    </div>
    <div style="background:#fef9c3;padding:12px 40px;border-bottom:1px solid #fde047;">
      <p style="margin:0;color:#713f12;font-size:13px;font-weight:500;">
        ⚠️ Sem decisão, em menos de 24h serão armazenadas para tratativas automaticamente.
      </p>
    </div>
    <div style="padding:28px 40px 8px;">
      <h1 style="margin:0 0 12px;font-size:20px;font-weight:700;color:#08366D;">
        Você tem ${count} devolução${count > 1 ? 'ões' : ''} aguardando decisão
      </h1>
      <p style="margin:0 0 4px;font-size:15px;line-height:1.6;color:#3f3f46;">
        Acesse o sistema para tomar uma decisão antes do prazo automático.
      </p>
    </div>
    <div style="padding:8px 40px;">
      <table style="width:100%;border-collapse:collapse;">
        <thead>
          <tr style="background:#f4f4f5;">
            <th style="padding:6px 12px;text-align:left;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:#71717a;">RV</th>
            <th style="padding:6px 12px;text-align:left;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:#71717a;">Recebido em</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <div style="padding:20px 40px 32px;text-align:center;">
      <a href="${appUrl}/cliente" style="display:inline-block;background:#08366D;color:#fff;font-size:15px;font-weight:600;padding:12px 32px;border-radius:6px;text-decoration:none;">
        Ver Devoluções
      </a>
    </div>
    <hr style="border:none;border-top:1px solid #e4e4e7;margin:0;">
    <div style="padding:24px 40px;">
      <p style="margin:0 0 4px;font-size:12px;color:#71717a;">
        Você recebe este e-mail porque tem devoluções pendentes vinculadas à sua conta.
      </p>
      <p style="margin:0;font-size:12px;color:#71717a;">
        Logvale Gestão de Devoluções ·
        <a href="${appUrl}/privacidade" style="color:#71717a;">Política de Privacidade</a>
      </p>
    </div>
  </div>
</body>
</html>`
}
