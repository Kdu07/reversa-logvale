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

interface AccountCreatedEmailProps {
  name:      string
  magicLink: string
  appUrl?:   string
}

export function AccountCreatedEmail({ name, magicLink, appUrl = '' }: AccountCreatedEmailProps) {
  const firstName = name?.trim().split(' ')[0] || ''

  return (
    <Html lang="pt-BR">
      <Head />
      <Preview>Ative seu acesso ao sistema de devoluções da Logvale</Preview>
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
            <Heading style={h1}>Bem-vindo à Logvale{firstName ? `, ${firstName}` : ''}!</Heading>
            <Text style={text}>
              Sua conta no sistema de gestão de devoluções da Logvale foi criada com sucesso.
              Estamos felizes em ter você com a gente.
            </Text>
            <Text style={text}>
              Para começar, clique no botão abaixo e siga estes passos rápidos:
            </Text>

            <Section style={stepsBox}>
              <Text style={step}><span style={stepNum}>1</span> Clique em <strong>“Ativar meu acesso”</strong>.</Text>
              <Text style={step}><span style={stepNum}>2</span> Crie uma senha pessoal (mínimo de 8 caracteres).</Text>
              <Text style={step}><span style={stepNum}>3</span> Leia e aceite os Termos de Uso e a Política de Privacidade.</Text>
              <Text style={stepLast}><span style={stepNum}>4</span> Pronto! Você já estará dentro do sistema.</Text>
            </Section>
          </Section>

          <Section style={btnSection}>
            <Button href={magicLink} style={btn}>
              Ativar meu acesso
            </Button>
          </Section>

          <Section style={{ padding: '0 40px 8px' }}>
            <Text style={{ ...text, color: '#dc2626', fontWeight: '500', margin: '0' }}>
              Por segurança, este link de ativação é válido por 1 hora.
            </Text>
            <Text style={{ ...text, fontSize: '13px', color: '#71717a' }}>
              Se o botão não funcionar, copie e cole este endereço no navegador:
              <br />
              <a href={magicLink} style={rawLink}>{magicLink}</a>
            </Text>
            <Text style={{ ...text, fontSize: '13px', color: '#71717a', margin: '0' }}>
              Depois desta primeira ativação, seu acesso passa a ser feito com e-mail e senha.
            </Text>
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
  margin:    '0 auto',
  display:   'block',
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

const stepsBox: React.CSSProperties = {
  backgroundColor: '#f8fafc',
  border:          '1px solid #e4e4e7',
  borderRadius:    '8px',
  padding:         '16px 20px',
  margin:          '8px 0 4px',
}

const step: React.CSSProperties = {
  color:      '#3f3f46',
  fontSize:   '14px',
  lineHeight: '1.5',
  margin:     '0 0 10px',
}

const stepLast: React.CSSProperties = {
  ...step,
  margin: '0',
}

const stepNum: React.CSSProperties = {
  display:         'inline-block',
  width:           '20px',
  height:          '20px',
  lineHeight:      '20px',
  textAlign:       'center',
  backgroundColor: PRIMARY,
  color:           '#ffffff',
  borderRadius:    '10px',
  fontSize:        '12px',
  fontWeight:      '700',
  marginRight:     '8px',
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
  color:         PRIMARY,
  wordBreak:     'break-all',
  fontSize:      '12px',
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
