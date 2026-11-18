import nodemailer, { type Transporter } from 'nodemailer'
import { render } from '@react-email/render'
import { env } from '@/lib/env'
import { AccountCreatedEmail } from '@/emails/AccountCreated'
import { PasswordResetEmail } from '@/emails/PasswordReset'
import { PendingDecisionWarningEmail } from '@/emails/PendingDecisionWarning'

let cached: Transporter | null = null

/** Login SMTP por usuário + senha de app (tem prioridade sobre a service account). */
function usesAppPassword(): boolean {
  return Boolean(env.smtpUser && env.smtpPass)
}

function transport(): Transporter {
  if (cached) return cached
  cached = nodemailer.createTransport({
    host:   env.smtpHost,
    port:   env.smtpPort,
    secure: env.smtpPort === 465, // 465 = TLS implícito; 587 = STARTTLS
    auth: usesAppPassword()
      // Senha de app (exige verificação em 2 etapas na conta). Serve para contas
      // @gmail.com pessoais, que a Domain-Wide Delegation não alcança.
      ? { user: env.smtpUser, pass: env.smtpPass }
      // OAuth2 com Service Account: o Nodemailer gera o token (JWT bearer) e
      // impersona `user` via Domain-Wide Delegation — sem senha. Só funciona para
      // caixas do Google Workspace com o serviço Gmail ativo.
      : {
          type:          'OAuth2',
          user:          env.gmailOAuthUser,     // caixa impersonada (sub do JWT)
          serviceClient: env.googleSaClientId,   // client_id (Unique ID) da service account
          privateKey:    env.googleSaPrivateKey, // private_key da service account
        },
  })
  return cached
}

/** True quando há host + (senha de app OU caixa impersonada + credenciais da service account). */
export function isEmailConfigured(): boolean {
  return Boolean(
    env.smtpHost && (
      usesAppPassword() ||
      (env.gmailOAuthUser && env.googleSaClientId && env.googleSaPrivateKey)
    ),
  )
}

export async function sendAccountCreatedEmail(params: {
  to:        string
  name:      string
  magicLink: string
}): Promise<void> {
  const html = await render(AccountCreatedEmail({ ...params, appUrl: env.appUrl }))
  // nodemailer.sendMail rejeita em caso de falha (auth, conexão, etc.) —
  // ao contrário do SDK do Resend, então o caller só precisa de try/catch.
  await transport().sendMail({
    from:    env.mailFrom,
    to:      params.to,
    subject: 'Bem-vindo à Logvale — ative seu acesso',
    html,
  })
}

export async function sendPasswordResetEmail(params: {
  to:        string
  name:      string
  resetLink: string
}): Promise<void> {
  const html = await render(PasswordResetEmail({ ...params, appUrl: env.appUrl }))
  await transport().sendMail({
    from:    env.mailFrom,
    to:      params.to,
    subject: 'Redefinição de senha — Logvale',
    html,
  })
}

export async function sendPendingWarningEmail(params: {
  to:      string
  returns: { rv: string; receivedAt: string }[]
}): Promise<void> {
  const count = params.returns.length
  const html  = await render(PendingDecisionWarningEmail(params))
  await transport().sendMail({
    from:    env.mailFrom,
    to:      params.to,
    subject: `${count} devolução${count > 1 ? 'ões' : ''} pendente${count > 1 ? 's' : ''} de decisão`,
    html,
  })
}
