import nodemailer, { type Transporter } from 'nodemailer'
import { render } from '@react-email/render'
import { env } from '@/lib/env'
import { AccountCreatedEmail } from '@/emails/AccountCreated'
import { PasswordResetEmail } from '@/emails/PasswordReset'
import { PendingDecisionWarningEmail } from '@/emails/PendingDecisionWarning'

let cached: Transporter | null = null

function transport(): Transporter {
  if (cached) return cached
  cached = nodemailer.createTransport({
    host:   env.smtpHost,
    port:   env.smtpPort,
    secure: env.smtpPort === 465, // 465 = TLS implícito; 587 = STARTTLS
    auth:   { user: env.smtpUser, pass: env.smtpPass },
  })
  return cached
}

/** True quando há host + usuário + senha SMTP configurados. */
export function isEmailConfigured(): boolean {
  return Boolean(env.smtpHost && env.smtpUser && env.smtpPass)
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
