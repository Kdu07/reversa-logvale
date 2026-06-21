import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Preview,
  Section,
  Text,
} from '@react-email/components'

interface PasswordResetEmailProps {
  name:      string
  resetLink: string
  appUrl?:   string
}

export function PasswordResetEmail({ name, resetLink, appUrl = '' }: PasswordResetEmailProps) {
  const firstName = name?.trim().split(' ')[0] || ''

  return (
    <Html lang="pt-BR">
      <Head />
      <Preview>Redefina a senha do seu acesso à Logvale</Preview>
      <Body style={body}>
        <Container style={container}>
          {/* Logo */}
          <Section style={logoSection}>
            <Img
              src={`${appUrl}/logvale-logo.png`}
              alt="Logvale"
              height="40"
              style={logoImg}
            />
          </Section>

          {/* Content */}
          <Section style={content}>
            <Heading style={h1}>Redefinição de senha{firstName ? `, ${firstName}` : ''}</Heading>
            <Text style={text}>
              Recebemos uma solicitação para redefinir a senha do seu acesso ao sistema
              de gestão de devoluções da Logvale. Clique no botão abaixo para criar uma
              nova senha.
            </Text>
          </Section>

          <Section style={btnSection}>
            <Button href={resetLink} style={btn}>
              Redefinir minha senha
            </Button>
          </Section>

          <Section style={{ padding: '0 40px 8px' }}>
            <Text style={{ ...text, color: '#dc2626', fontWeight: '500', margin: '0' }}>
              Por segurança, este link de redefinição é válido por 24 horas.
            </Text>
            <Text style={{ ...text, fontSize: '13px', color: '#71717a' }}>
              Se o botão não funcionar, copie e cole este endereço no navegador:
              <br />
              <a href={resetLink} style={rawLink}>{resetLink}</a>
            </Text>
          </Section>

          <Hr style={hr} />

          <Section style={footer}>
            <Text style={footerText}>
              Se você não solicitou a redefinição, pode ignorar este e-mail com segurança —
              sua senha atual continua válida.
            </Text>
            <Text style={footerText}>
              Logvale Gestão de Devoluções ·{' '}
              <a href="https://logvale.com.br/privacidade" style={footerLink}>
                Política de Privacidade
              </a>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

const PRIMARY = '#08366D'

const body: React.CSSProperties = {
  backgroundColor: '#f4f4f5',
  fontFamily:      'Arial, Helvetica, sans-serif',
}

const container: React.CSSProperties = {
  backgroundColor: '#ffffff',
  margin:          '40px auto',
  padding:         '0',
  maxWidth:        '560px',
  borderRadius:    '8px',
  overflow:        'hidden',
}

const logoSection: React.CSSProperties = {
  backgroundColor: PRIMARY,
  padding:         '24px 40px',
  textAlign:       'center',
}

const logoImg: React.CSSProperties = {
  margin:  '0 auto',
  display: 'block',
}

const hr: React.CSSProperties = {
  borderColor: '#e4e4e7',
  margin:      '0',
}

const content: React.CSSProperties = {
  padding: '32px 40px 8px',
}

const h1: React.CSSProperties = {
  color:      PRIMARY,
  fontSize:   '20px',
  fontWeight: '700',
  margin:     '0 0 16px',
}

const text: React.CSSProperties = {
  color:      '#3f3f46',
  fontSize:   '15px',
  lineHeight: '1.6',
  margin:     '0 0 12px',
}

const btnSection: React.CSSProperties = {
  padding:   '16px 40px 8px',
  textAlign: 'center',
}

const btn: React.CSSProperties = {
  backgroundColor: PRIMARY,
  borderRadius:    '6px',
  color:           '#ffffff',
  fontSize:        '15px',
  fontWeight:      '600',
  padding:         '12px 32px',
  textDecoration:  'none',
  display:         'inline-block',
}

const rawLink: React.CSSProperties = {
  color:     PRIMARY,
  wordBreak: 'break-all',
  fontSize:  '12px',
}

const footer: React.CSSProperties = {
  padding: '24px 40px',
}

const footerText: React.CSSProperties = {
  color:    '#71717a',
  fontSize: '12px',
  margin:   '0 0 4px',
}

const footerLink: React.CSSProperties = {
  color:          '#71717a',
  textDecoration: 'underline',
}
