# Jobs Automáticos — Logvale

## Visão Geral

| Job | Frequência | Implementação |
|---|---|---|
| `auto-decision-job` | A cada hora | SQL puro via pg_cron |
| `warning-email-job` | A cada hora | Edge Function + pg_cron |
| `photo-cleanup-job` | Diário (02:00 UTC) | Edge Function + pg_cron |

---

## 1. auto-decision-job

Definido em `supabase/migrations/000_schema.sql` e criado automaticamente pelo `supabase db push`. Roda diretamente em SQL — nenhuma edge function necessária.

Lógica: atualiza returns com `status = 'awaiting_decision'` e `received_at < now() - 72h` para `decided` com `decision = 'store_for_handling'` e `decided_by_type = 'auto'`.

---

## 2. Deploy das Edge Functions

> **Status:** As Edge Functions `warning-email` e `photo-cleanup` estão implementadas em `supabase/functions/` (`warning-email/index.ts` e `photo-cleanup/index.ts`). Siga os passos abaixo para fazer o deploy em produção.

### Pré-requisitos

```bash
npm install -g supabase
supabase login
supabase link --project-ref <PROJECT_REF>
```

### Deploy

```bash
supabase functions deploy warning-email
supabase functions deploy photo-cleanup
```

### Configurar Secrets

```bash
supabase secrets set \
  RESEND_API_KEY=re_xxxxxxxxxxxx \
  RESEND_FROM_EMAIL=notificacoes@logvale.com.br \
  NEXT_PUBLIC_APP_URL=https://logvale.com.br
```

> As variáveis `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` são injetadas automaticamente pelo runtime Supabase.

---

## 3. Agendar via pg_cron

Execute no **SQL Editor** do Supabase (substitua `<PROJECT_REF>` e `<SERVICE_ROLE_KEY>`):

```sql
-- warning-email: a cada hora
SELECT cron.schedule(
  'warning-email-job',
  '0 * * * *',
  $$
    SELECT net.http_post(
      url     := 'https://<PROJECT_REF>.supabase.co/functions/v1/warning-email',
      headers := '{"Content-Type":"application/json","Authorization":"Bearer <SERVICE_ROLE_KEY>"}'::jsonb,
      body    := '{}'::jsonb
    );
  $$
);

-- photo-cleanup: diariamente às 02:00 UTC
SELECT cron.schedule(
  'photo-cleanup-job',
  '0 2 * * *',
  $$
    SELECT net.http_post(
      url     := 'https://<PROJECT_REF>.supabase.co/functions/v1/photo-cleanup',
      headers := '{"Content-Type":"application/json","Authorization":"Bearer <SERVICE_ROLE_KEY>"}'::jsonb,
      body    := '{}'::jsonb
    );
  $$
);
```

> O `PROJECT_REF` está na URL do seu projeto Supabase: `https://supabase.com/dashboard/project/<PROJECT_REF>`.  
> O `SERVICE_ROLE_KEY` está em: Settings → API → `service_role` secret.

---

## 4. Verificar Jobs Ativos

```sql
-- Listar jobs agendados
SELECT jobname, schedule, command FROM cron.job;

-- Ver histórico de execuções
SELECT jobname, start_time, status, return_message
FROM cron.job_run_details
ORDER BY start_time DESC
LIMIT 20;
```

---

## 5. Monitorar Logs das Edge Functions

- Supabase Dashboard → **Edge Functions** → selecione a função → **Logs**
- Logs estruturados com prefixo `[warning-email]` e `[photo-cleanup]` para filtragem fácil

---

## 6. Testar Manualmente

```bash
# warning-email
curl -X POST \
  https://<PROJECT_REF>.supabase.co/functions/v1/warning-email \
  -H "Authorization: Bearer <SERVICE_ROLE_KEY>" \
  -H "Content-Type: application/json"

# photo-cleanup
curl -X POST \
  https://<PROJECT_REF>.supabase.co/functions/v1/photo-cleanup \
  -H "Authorization: Bearer <SERVICE_ROLE_KEY>" \
  -H "Content-Type: application/json"
```

---

## 7. Remover Job (se necessário)

```sql
SELECT cron.unschedule('warning-email-job');
SELECT cron.unschedule('photo-cleanup-job');
```
