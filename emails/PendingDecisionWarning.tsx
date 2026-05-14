import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Row,
  Column,
  Section,
  Text,
} from '@react-email/components'

interface PendingReturn {
  rv:         string
  receivedAt: string
}

interface PendingDecisionWarningEmailProps {
  returns: PendingReturn[]
  appUrl?: string
}

export function PendingDecisionWarningEmail({
  returns,
  appUrl = 'https://logvale.com.br',
}: PendingDecisionWarningEmailProps) {
  const count   = returns.length
  const subject = count === 1 ? '1 devolução aguarda' : `${count} devoluções aguardam`

  return (
    <Html lang="pt-BR">
      <Head />
      <Preview>{subject} sua decisão — prazo se esgota em menos de 24h</Preview>
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

          {/* Alert banner */}
          <Section style={alertSection}>
            <Text style={alertText}>
              ⚠️ Sem decisão, em menos de 24h serão armazenadas automaticamente para tratativas.
            </Text>
          </Section>

          {/* Content */}
          <Section style={content}>
            <Heading style={h1}>
              {count === 1
                ? 'Você tem 1 devolução aguardando decisão'
                : `Você tem ${count} devoluções aguardando decisão`}
            </Heading>
            <Text style={text}>
              As devoluções abaixo estão pendentes há mais de 48 horas. Acesse o sistema
              para tomar uma decisão antes do prazo automático.
            </Text>
          </Section>

          {/* Returns list */}
          <Section style={tableSection}>
            <Row style={tableHeader}>
              <Column style={colRv}><Text style={tableHeaderText}>RV</Text></Column>
              <Column style={colDate}><Text style={tableHeaderText}>Recebido em</Text></Column>
            </Row>
            {returns.map((r) => (
              <Row key={r.rv} style={tableRow}>
                <Column style={colRv}>
                  <Text style={tableCell}>{r.rv}</Text>
                </Column>
                <Column style={colDate}>
                  <Text style={tableCell}>{formatDate(r.receivedAt)}</Text>
                </Column>
              </Row>
            ))}
          </Section>

          <Section style={btnSection}>
            <Button href={`${appUrl}/cliente`} style={btn}>
              Ver Devoluções
            </Button>
          </Section>

          <Hr style={hr} />

          <Section style={footer}>
            <Text style={footerText}>
              Você recebe este e-mail porque tem devoluções pendentes vinculadas à sua conta.
            </Text>
            <Text style={footerText}>
              Logvale Gestão de Devoluções ·{' '}
              <a href={`${appUrl}/privacidade`} style={footerLink}>
                Política de Privacidade
              </a>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
    timeZone: 'America/Sao_Paulo',
  })
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
  fontSize:      '28px',
  fontWeight:    '700',
  letterSpacing: '2px',
  margin:        '0',
}

const logoBlue: React.CSSProperties = { color: '#ffffff' }
const logoRed:  React.CSSProperties = { color: ACCENT }

const hr: React.CSSProperties = {
  borderColor: '#e4e4e7',
  margin:      '0',
}

const alertSection: React.CSSProperties = {
  backgroundColor: '#fef9c3',
  padding:         '12px 40px',
  borderBottom:    '1px solid #fde047',
}

const alertText: React.CSSProperties = {
  color:      '#713f12',
  fontSize:   '13px',
  margin:     '0',
  fontWeight: '500',
}

const content: React.CSSProperties = {
  padding: '28px 40px 8px',
}

const h1: React.CSSProperties = {
  color:      PRIMARY,
  fontSize:   '20px',
  fontWeight: '700',
  margin:     '0 0 12px',
}

const text: React.CSSProperties = {
  color:      '#3f3f46',
  fontSize:   '15px',
  lineHeight: '1.6',
  margin:     '0 0 4px',
}

const tableSection: React.CSSProperties = {
  padding: '8px 40px',
}

const tableHeader: React.CSSProperties = {
  backgroundColor: '#f4f4f5',
  borderRadius:    '4px',
}

const tableHeaderText: React.CSSProperties = {
  color:      '#71717a',
  fontSize:   '11px',
  fontWeight: '600',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  margin:     '6px 0',
}

const tableRow: React.CSSProperties = {
  borderBottom: '1px solid #f4f4f5',
}

const tableCell: React.CSSProperties = {
  color:    '#18181b',
  fontSize: '13px',
  margin:   '8px 0',
}

const colRv:   React.CSSProperties = { width: '40%' }
const colDate: React.CSSProperties = { width: '60%' }

const btnSection: React.CSSProperties = {
  padding:   '20px 40px 32px',
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
