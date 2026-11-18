import { describe, it, expect, vi, beforeEach } from 'vitest'

// Qual autenticação SMTP o transporte usa: senha de app (SMTP_USER + SMTP_PASS)
// tem prioridade; sem ela, OAuth2 via service account. O transporte é cacheado
// no módulo, então cada caso recarrega o módulo com vi.resetModules().

const createTransport = vi.hoisted(() => vi.fn(() => ({ sendMail: vi.fn().mockResolvedValue({}) })))
vi.mock('nodemailer', () => ({ default: { createTransport } }))
vi.mock('@react-email/render', () => ({ render: vi.fn().mockResolvedValue('<html/>') }))
vi.mock('@/emails/AccountCreated', () => ({ AccountCreatedEmail: vi.fn(() => null) }))
vi.mock('@/emails/PasswordReset', () => ({ PasswordResetEmail: vi.fn(() => null) }))
vi.mock('@/emails/PendingDecisionWarning', () => ({ PendingDecisionWarningEmail: vi.fn(() => null) }))

const env = vi.hoisted(() => ({}) as Record<string, unknown>)
vi.mock('@/lib/env', () => ({ env }))

const BASE = {
  appUrl:   'http://localhost:3000',
  mailFrom: 'remetente@test.com',
  smtpHost: 'smtp.gmail.com',
  smtpPort: 465,
}
const SA = {
  gmailOAuthUser:     'caixa@empresa.com',
  googleSaClientId:   '123',
  googleSaPrivateKey: '-----BEGIN PRIVATE KEY-----\nx\n-----END PRIVATE KEY-----\n',
}

async function load(overrides: Record<string, unknown>) {
  for (const k of Object.keys(env)) delete env[k]
  Object.assign(env, BASE, overrides)
  vi.resetModules()
  return import('@/lib/integrations/email')
}

beforeEach(() => createTransport.mockClear())

describe('transporte SMTP', () => {
  it('usa senha de app quando SMTP_USER + SMTP_PASS existem (mesmo com a service account configurada)', async () => {
    const mod = await load({ ...SA, smtpUser: 'pessoal@gmail.com', smtpPass: 'abcdefghijklmnop' })

    await mod.sendAccountCreatedEmail({ to: 'a@b.com', name: 'A', magicLink: 'l' })

    expect(createTransport).toHaveBeenCalledWith(expect.objectContaining({
      host: 'smtp.gmail.com', port: 465, secure: true,
      auth: { user: 'pessoal@gmail.com', pass: 'abcdefghijklmnop' },
    }))
    expect(mod.isEmailConfigured()).toBe(true)
  })

  it('usa OAuth2 da service account quando não há senha de app', async () => {
    const mod = await load({ ...SA })

    await mod.sendAccountCreatedEmail({ to: 'a@b.com', name: 'A', magicLink: 'l' })

    expect(createTransport).toHaveBeenCalledWith(expect.objectContaining({
      auth: expect.objectContaining({ type: 'OAuth2', user: 'caixa@empresa.com', serviceClient: '123' }),
    }))
  })

  it('só usuário sem senha não ativa o modo senha de app', async () => {
    const mod = await load({ smtpUser: 'pessoal@gmail.com' })

    expect(mod.isEmailConfigured()).toBe(false)
  })

  it('senha de app sozinha (sem service account) já basta', async () => {
    const mod = await load({ smtpUser: 'pessoal@gmail.com', smtpPass: 'x' })

    expect(mod.isEmailConfigured()).toBe(true)
  })
})
