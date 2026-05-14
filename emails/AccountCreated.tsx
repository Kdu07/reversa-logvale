import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components'

interface AccountCreatedEmailProps {
  name:      string
  magicLink: string
}

export function AccountCreatedEmail({ name, magicLink }: AccountCreatedEmailProps) {
  return (
    <Html lang="pt-BR">
      <Head />
      <Preview>Seu acesso ao Sistema Logvale foi criado</Preview>
      <Body style={body}>
        <Container style={container}>
          {/* Logo */}
          <Section style={logoSection}>
            <Heading style={logo}>
              <span style={logoBlue}>LOG</span>
              <span style={logoRed}>V</span>
              <span style={logoBlue}>ALE</span>
            </Heading>
          </Section>

          <Hr style={hr} />

          {/* Content */}
          <Section style={content}>
            <Heading style={h1}>Bem-vindo ao sistema de devoluções</Heading>
            <Text style={text}>Olá, {name}.</Text>
            <Text style={text}>
              Sua conta no sistema Logvale de gestão de devoluções foi criada.
              Clique no botão abaixo para acessar o sistema.
            </Text>
            <Text style={{ ...text, color: '#dc2626', fontWeight: '500' }}>
              Este link é válido por 10 minutos.
            </Text>
          </Section>

          <Section style={btnSection}>
            <Button href={magicLink} style={btn}>
              Acessar Logvale
            </Button>
          </Section>

          <Hr style={hr} />

          <Section style={footer}>
            <Text style={footerText}>
              Se você não esperava este e-mail, pode ignorá-lo com segurança.
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
const ACCENT  = '#F12D46'

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

const logo: React.CSSProperties = {
  fontSize:    '28px',
  fontWeight:  '700',
  letterSpacing: '2px',
  margin:      '0',
}

const logoBlue: React.CSSProperties = { color: '#ffffff' }
const logoRed:  React.CSSProperties = { color: ACCENT }

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
  padding:   '16px 40px 32px',
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
