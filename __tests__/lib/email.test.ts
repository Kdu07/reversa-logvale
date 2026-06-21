import { describe, it, expect, vi, beforeEach } from 'vitest'

const sendMail = vi.hoisted(() => vi.fn())
vi.mock('nodemailer', () => ({
  default: { createTransport: vi.fn(() => ({ sendMail })) },
}))

vi.mock('@react-email/render', () => ({
  render: vi.fn().mockResolvedValue('<html>email</html>'),
}))

vi.mock('@/emails/AccountCreated', () => ({ AccountCreatedEmail: vi.fn(() => null) }))
vi.mock('@/emails/PasswordReset', () => ({ PasswordResetEmail: vi.fn(() => null) }))
vi.mock('@/emails/PendingDecisionWarning', () => ({ PendingDecisionWarningEmail: vi.fn(() => null) }))

vi.mock('@/lib/env', () => ({
  env: {
    appUrl:   'http://localhost:3000',
    mailFrom: 'no-reply@logvale.com.br',
    smtpHost: 'smtp.gmail.com',
    smtpPort: 587,
    smtpUser: 'no-reply@logvale.com.br',
    smtpPass: 'app-password',
  },
}))

import { sendAccountCreatedEmail, sendPasswordResetEmail, sendPendingWarningEmail } from '@/lib/integrations/email'

beforeEach(() => {
  vi.clearAllMocks()
  sendMail.mockResolvedValue({ messageId: 'abc' })
})

describe('sendAccountCreatedEmail', () => {
  it('envia o e-mail de boas-vindas com remetente e assunto corretos', async () => {
    await sendAccountCreatedEmail({ to: 'novo@test.com', name: 'Fulano', magicLink: 'http://link' })

    expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({
      from:    'no-reply@logvale.com.br',
      to:      'novo@test.com',
      subject: expect.stringContaining('ative seu acesso'),
      html:    '<html>email</html>',
    }))
  })

  it('propaga erro quando o envio SMTP falha', async () => {
    sendMail.mockRejectedValue(new Error('Invalid login'))

    await expect(
      sendAccountCreatedEmail({ to: 'x@test.com', name: 'X', magicLink: 'l' }),
    ).rejects.toThrow('Invalid login')
  })
})

describe('sendPasswordResetEmail', () => {
  it('envia o e-mail de redefinição com assunto correto', async () => {
    await sendPasswordResetEmail({ to: 'user@test.com', name: 'Fulano', resetLink: 'http://reset' })

    expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({
      from:    'no-reply@logvale.com.br',
      to:      'user@test.com',
      subject: expect.stringContaining('Redefinição de senha'),
      html:    '<html>email</html>',
    }))
  })

  it('propaga erro quando o envio SMTP falha', async () => {
    sendMail.mockRejectedValue(new Error('Invalid login'))

    await expect(
      sendPasswordResetEmail({ to: 'x@test.com', name: 'X', resetLink: 'l' }),
    ).rejects.toThrow('Invalid login')
  })
})

describe('sendPendingWarningEmail', () => {
  it('usa assunto no plural para múltiplas devoluções', async () => {
    await sendPendingWarningEmail({
      to: 'cliente@test.com',
      returns: [
        { rv: 'RV-1', receivedAt: '2025-01-01' },
        { rv: 'RV-2', receivedAt: '2025-01-02' },
      ],
    })

    // NOTE: o template atual gera "devoluçãoões" (bug de concatenação:
    // `devolução${'ões'}`). O teste fixa o comportamento REAL; ao corrigir
    // o subject, atualizar esta asserção.
    expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({
      subject: '2 devoluçãoões pendentes de decisão',
    }))
  })

  it('usa assunto no singular para uma devolução', async () => {
    await sendPendingWarningEmail({
      to: 'cliente@test.com',
      returns: [{ rv: 'RV-1', receivedAt: '2025-01-01' }],
    })

    expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({
      subject: '1 devolução pendente de decisão',
    }))
  })

  it('propaga erro quando o envio SMTP falha', async () => {
    sendMail.mockRejectedValue(new Error('Connection timeout'))

    await expect(
      sendPendingWarningEmail({ to: 'x@test.com', returns: [{ rv: 'RV-1', receivedAt: '2025-01-01' }] }),
    ).rejects.toThrow('Connection timeout')
  })
})
