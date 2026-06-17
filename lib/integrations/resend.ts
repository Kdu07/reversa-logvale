import { Resend } from 'resend'
import { render } from '@react-email/render'
import { env } from '@/lib/env'
import { AccountCreatedEmail } from '@/emails/AccountCreated'
import { PendingDecisionWarningEmail } from '@/emails/PendingDecisionWarning'

function client() {
  return new Resend(env.resendApiKey)
}

export async function sendAccountCreatedEmail(params: {
  to:        string
  name:      string
  magicLink: string
}): Promise<void> {
  const html = await render(AccountCreatedEmail({ ...params, appUrl: env.appUrl }))
  const { error } = await client().emails.send({
    from:    env.resendFrom,
    to:      params.to,
    subject: 'Bem-vindo à Logvale — ative seu acesso',
    html,
  })
  // The Resend SDK returns { error } instead of throwing on API failures
  // (invalid key, unverified sender domain, etc.). Surface it so callers know.
  if (error) throw new Error(`Resend: ${error.message}`)
}

export async function sendPendingWarningEmail(params: {
  to:      string
  returns: { rv: string; receivedAt: string }[]
}): Promise<void> {
  const count = params.returns.length
  const html  = await render(PendingDecisionWarningEmail(params))
  const { error } = await client().emails.send({
    from:    env.resendFrom,
    to:      params.to,
    subject: `${count} devolução${count > 1 ? 'ões' : ''} pendente${count > 1 ? 's' : ''} de decisão`,
    html,
  })
  if (error) throw new Error(`Resend: ${error.message}`)
}
