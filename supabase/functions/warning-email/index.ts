import { createClient } from 'npm:@supabase/supabase-js@2'
import { Resend } from 'npm:resend'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)
const resend  = new Resend(Deno.env.get('RESEND_API_KEY')!)
const FROM    = Deno.env.get('RESEND_FROM_EMAIL') ?? 'notificacoes@logvale.com.br'
const APP_URL = Deno.env.get('NEXT_PUBLIC_APP_URL') ?? 'https://logvale.com.br'

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

  let sent = 0
  for (const [clientId, clientRows] of byClient) {
    try {
      const { data: { user }, error: userErr } = await supabase.auth.admin.getUserById(clientId)
      if (userErr || !user?.email) {
        console.warn(`[warning-email] no email for client ${clientId}`)
        continue
      }

      const returns = clientRows.map((r) => ({ rv: r.rv, receivedAt: r.received_at }))

      await resend.emails.send({
        from:    FROM,
        to:      user.email,
        subject: `${returns.length} devolução${returns.length > 1 ? 'ões' : ''} pendente${returns.length > 1 ? 's' : ''} de decisão`,
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
      console.error(`[warning-email] failed for client ${clientId}:`, e)
    }
  }

  return json({ sent })
})

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
