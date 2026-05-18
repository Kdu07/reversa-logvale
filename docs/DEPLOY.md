# Deploy — Logvale Devoluções

Guia passo a passo para colocar o sistema em produção no **Supabase** + **Vercel**.
Volume esperado: **~2.000 devoluções/mês**.

---

## Parte 1 — Supabase

### 1.1 Criar o Projeto

1. Acesse [supabase.com](https://supabase.com) e clique em **New Project**
2. Preencha:
   - **Name:** `logvale-prod` (ou o nome que preferir)
   - **Database Password:** gere uma senha forte e **salve em local seguro**
   - **Region:** `South America (São Paulo)` — menor latência para usuários brasileiros
3. Clique em **Create new project** e aguarde ~2 minutos
4. Quando carregar, vá em **Project Settings → API** e anote:
   - `Project URL` → será seu `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` → será seu `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` → será seu `SUPABASE_SERVICE_ROLE_KEY` (**nunca exponha este**)
5. Vá em **Project Settings → General** e anote o **Reference ID** (ex.: `abcdefghijklm`)

> **Plano recomendado:** Pro ($25/mês). O Free tem apenas 1 GB de Storage; com ~7 fotos por devolução a 2000/mês você consumirá ~3 GB/mês. O Pro inclui 100 GB.

---

### 1.2 Aplicar Migrations via CLI (sem acessar o SQL Editor)

Todas as migrations estão em `supabase/migrations/` e são aplicadas em ordem com um único comando.

**Pré-requisito:** instalar o Supabase CLI

```bash
npm install -g supabase
```

**Configurar o project_id:**

Abra `supabase/config.toml` e substitua o valor de `project_id`:

```toml
project_id = "seu-reference-id-aqui"   # ← Project Settings → General → Reference ID
```

**Aplicar todas as migrations de uma vez:**

```bash
supabase login
# Abrirá o navegador para autenticar

supabase link --project-ref seu-reference-id-aqui

supabase db push
# Aplica em ordem:
#   000_schema.sql  — tabelas, enums, RLS, funções, pg_cron
#   001_storage.sql — buckets e storage policies
#   002_auth_hook.sql — função do JWT customizado
#   003_dashboard_stats_fn.sql — função de estatísticas do dashboard
```

Confirme o resultado no painel:
- **Database → Tables:** `profiles`, `depositors`, `client_depositors`, `invoice_cache`, `returns`, `return_photos`
- **Storage:** `box-photos`, `item-photos`, `invoice-xmls`

---

### 1.3 Registrar o Auth Hook no Dashboard (único passo manual)

A função `custom_access_token_hook` já foi criada pelo `supabase db push`. Só falta ativá-la no dashboard — isso não é possível via CLI.

1. Vá em **Authentication → Hooks**
2. Localize **Custom Access Token Hook** e clique em **Enable**
3. Em **Hook function**, selecione `public.custom_access_token_hook`
4. Clique em **Save**

> Sem este hook, login funciona mas o middleware fará uma query extra ao banco em cada requisição.

---

### 1.5 Criar o Primeiro Manager

Após registrar o hook, crie o usuário administrador inicial:

1. Vá em **Authentication → Users → Add user → Create new user**
2. Preencha o e-mail e senha do administrador e clique em **Create User**
3. Copie o **UUID** do usuário criado (coluna ID)
4. No **SQL Editor**, execute:

```sql
INSERT INTO public.profiles (id, role, full_name, terms_accepted_at)
VALUES ('<cole-o-uuid-aqui>', 'manager', 'Seu Nome', now());
```

5. Faça login em [localhost:3000](http://localhost:3000) com as credenciais criadas para validar

---

### 1.6 Configurar o pg_cron (Job de Auto-Decisão)

O job `auto-decision-job` já está incluído no `docs/SCHEMA.sql` e roda automaticamente a cada hora para marcar devoluções sem decisão após 72h.

Para verificar que foi criado corretamente:

```sql
SELECT jobname, schedule, command FROM cron.job;
```

Deve aparecer `auto-decision-job` com schedule `0 * * * *`.

> **Atenção:** `pg_cron` requer o plano **Pro ou superior** do Supabase. No Free, o job não rodará.

---

### 1.7 Fazer Deploy das Edge Functions

As Edge Functions enviam e-mails de aviso (48h) e limpam fotos antigas (1 ano).

**Pré-requisito:** instalar o Supabase CLI

```bash
npm install -g supabase
```

**Login e link com o projeto:**

```bash
supabase login
# Abrirá o navegador para autenticar

supabase link --project-ref <project-ref>
# O project-ref está em: Project Settings → General → Reference ID
```

**Deploy das functions:**

```bash
supabase functions deploy warning-email
supabase functions deploy photo-cleanup
```

**Configurar secrets das functions:**

```bash
supabase secrets set RESEND_API_KEY=re_suaSuaChaveAqui
supabase secrets set RESEND_FROM_EMAIL=notificacoes@logvale.com.br
supabase secrets set NEXT_PUBLIC_APP_URL=https://seudominio.com.br
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=eyJ...suaServiceRoleKey
```

---

### 1.8 Agendar as Edge Functions via pg_cron

As Edge Functions precisam ser chamadas via HTTP pelo cron. Execute no **SQL Editor**:

```sql
-- Warning e-mail: a cada hora, verifica devoluções entre 48h e 72h pendentes
SELECT cron.schedule(
  'warning-email-job',
  '0 * * * *',
  $$
    SELECT net.http_post(
      url := 'https://<project-ref>.supabase.co/functions/v1/warning-email',
      headers := jsonb_build_object(
        'Authorization', 'Bearer <sua-service-role-key>',
        'Content-Type', 'application/json'
      ),
      body := '{}'::jsonb
    );
  $$
);

-- Photo cleanup: todo dia às 3h da manhã, remove fotos de devoluções > 1 ano
SELECT cron.schedule(
  'photo-cleanup-job',
  '0 3 * * *',
  $$
    SELECT net.http_post(
      url := 'https://<project-ref>.supabase.co/functions/v1/photo-cleanup',
      headers := jsonb_build_object(
        'Authorization', 'Bearer <sua-service-role-key>',
        'Content-Type', 'application/json'
      ),
      body := '{}'::jsonb
    );
  $$
);
```

> Substitua `<project-ref>` e `<sua-service-role-key>` pelos valores reais.

---

### 1.9 Configurar o SMTP (E-mail Auth)

Para que o Supabase envie e-mails de magic link / confirmação com seu domínio:

1. Vá em **Project Settings → Authentication → SMTP Settings**
2. Habilite **Enable Custom SMTP**
3. Use as credenciais do Resend (ou outro provedor SMTP):
   - **Host:** `smtp.resend.com`
   - **Port:** `465`
   - **User:** `resend`
   - **Password:** sua `RESEND_API_KEY`
   - **Sender email:** `notificacoes@seudominio.com.br`
4. Em **URL Configuration**, defina:
   - **Site URL:** `https://seudominio.com.br`
   - **Redirect URLs:** adicione `https://seudominio.com.br/auth/callback`

---

## Parte 2 — Vercel

### 2.1 Conectar o Repositório

1. Acesse [vercel.com](https://vercel.com) e clique em **Add New → Project**
2. Conecte sua conta do GitHub e selecione o repositório `reversa-logvale`
3. Na tela de configuração:
   - **Framework Preset:** Next.js (detectado automaticamente)
   - **Root Directory:** `/` (raiz, padrão)
   - **Build Command:** `next build` (padrão)
   - **Output Directory:** `.next` (padrão)
4. **Não clique em Deploy ainda** — configure as variáveis de ambiente primeiro

---

### 2.2 Configurar Variáveis de Ambiente

Ainda na tela de importação (ou em **Settings → Environment Variables** depois):

| Variável | Valor | Ambiente |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xxx.supabase.co` | All |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJ...` | All |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJ...` | Production, Preview |
| `NEXT_PUBLIC_APP_URL` | `https://seudominio.com.br` | Production |
| `NEXT_PUBLIC_APP_URL` | `https://logvale-dev.vercel.app` | Preview |
| `WEBMANIA_API_TOKEN` | `seu-token` | Production, Preview |
| `WEBMANIA_CONSUMER_SECRET` | `seu-secret` | Production, Preview |
| `WEBMANIA_BASE_URL` | `https://api.webmaniabr.com` | All |
| `RESEND_API_KEY` | `re_xxx` | Production, Preview |
| `RESEND_FROM_EMAIL` | `notificacoes@seudominio.com.br` | Production, Preview |
| `NEXT_PUBLIC_SENTRY_DSN` | `https://...@sentry.io/...` | Production |
| `SENTRY_DSN` | `https://...@sentry.io/...` | Production |
| `NODE_ENV` | `production` | Production |

> `SUPABASE_SERVICE_ROLE_KEY` nunca deve ter prefixo `NEXT_PUBLIC_` — ela é usada apenas server-side.

Clique em **Deploy** após configurar todas as variáveis.

---

### 2.3 Configurar Domínio Customizado

1. Após o deploy inicial, vá em **Settings → Domains**
2. Clique em **Add Domain** e digite `seudominio.com.br`
3. O Vercel mostrará os registros DNS a configurar no seu registrador (ex.: Registro.br)
4. Configure os registros DNS:
   - Se usar subdomínio (`www.`): tipo `CNAME` apontando para `cname.vercel-dns.com`
   - Se usar apex (`@`): tipo `A` apontando para `76.76.21.21`
5. Aguarde propagação (~30 minutos) e o Vercel provisionará SSL automaticamente
6. Atualize `NEXT_PUBLIC_APP_URL` na Vercel para o domínio final

---

### 2.4 Configurar CI/CD Automático

O arquivo `.github/workflows/ci.yml` já está configurado e roda lint + testes a cada PR.

Para adicionar os secrets do CI no GitHub:

1. No repositório GitHub, vá em **Settings → Secrets and variables → Actions**
2. Adicione os secrets:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`

---

## Parte 3 — Serviços Externos

### 3.1 Webmania (Consulta NF-e)

1. Crie conta em [webmaniabr.com](https://webmaniabr.com)
2. Acesse **API → NFe → Consulta por Chave de Acesso**
3. Anote o **Token** e o **Consumer Secret**
4. Configure nos dois lugares:
   - `.env.local` para desenvolvimento
   - Vercel Environment Variables para produção

> Em desenvolvimento sem o token configurado, o sistema usa mock data automaticamente.

### 3.2 Resend (E-mails Transacionais)

1. Crie conta em [resend.com](https://resend.com)
2. Vá em **Domains → Add Domain** e adicione `seudominio.com.br`
3. Configure os registros DNS que o Resend mostrar (TXT, MX, DKIM)
4. Aguarde a verificação (~24h) — status ficará verde
5. Vá em **API Keys → Create API Key** e copie a chave
6. Configure `RESEND_API_KEY` no Vercel e nos secrets das Edge Functions

### 3.3 Sentry (Monitoramento de Erros) — Opcional

1. Crie conta em [sentry.io](https://sentry.io)
2. Clique em **Create Project → Next.js**
3. Copie o **DSN** mostrado
4. Configure `NEXT_PUBLIC_SENTRY_DSN` e `SENTRY_DSN` no Vercel

---

## Checklist Final

Execute estes passos **na ordem** antes de liberar para usuários reais:

### Supabase
- [ ] Projeto criado na região São Paulo
- [ ] `project_id` preenchido em `supabase/config.toml`
- [ ] `supabase db push` executado — tabelas, buckets e funções criados
- [ ] Auth Hook registrado no Dashboard (Authentication → Hooks) — único passo manual
- [ ] Primeiro manager criado (auth + profile insert)
- [ ] pg_cron verificado — `auto-decision-job` aparece em `cron.job`
- [ ] Edge Functions deployadas (`warning-email`, `photo-cleanup`)
- [ ] Secrets das Edge Functions configurados
- [ ] Jobs do cron para Edge Functions agendados
- [ ] SMTP customizado configurado (Authentication → SMTP Settings)
- [ ] Site URL e Redirect URLs configurados (Authentication → URL Configuration)

### Vercel
- [ ] Repositório conectado e primeiro deploy realizado
- [ ] Todas as variáveis de ambiente configuradas
- [ ] Domínio customizado adicionado e DNS configurado
- [ ] SSL ativo (Vercel faz automaticamente após DNS propagado)
- [ ] `NEXT_PUBLIC_APP_URL` atualizado para domínio de produção

### Serviços Externos
- [ ] Webmania: token e secret configurados e testados
- [ ] Resend: domínio verificado, API key configurada
- [ ] GitHub Secrets configurados para CI/CD

### Validação Funcional
- [ ] Login do manager funcionando
- [ ] Criação de operador/cliente via `/admin/usuarios`
- [ ] Fluxo de recebimento completo pelo operador (com fotos)
- [ ] Decisão de cliente funcionando
- [ ] E-mail de aviso recebido após 48h (testar manualmente invocando a function)
- [ ] Auto-decisão após 72h (simular ou aguardar)
- [ ] Lighthouse > 90 em `/operador/recebimento` e `/cliente`

---

## Custos Estimados — 2.000 Devoluções/Mês

| Serviço | Plano | Custo |
|---|---|---|
| Supabase | Pro | $25/mês |
| Vercel | Hobby (Free) | $0 |
| Webmania | ~2.000 consultas/mês (com cache ~50%) | ~R$ 150/mês |
| Resend | Free (3.000 e-mails/mês) | $0 |
| Domínio | .com.br anual | ~R$ 40/mês |
| **Total** | | **~R$ 300/mês** |

> Vercel Hobby tem limite de 100 GB de banda/mês — suficiente para este volume. Mude para Pro ($20/mês) se precisar de SLA, equipe ou mais builds simultâneos.

---

## Referência Rápida

| Onde encontrar | O quê |
|---|---|
| Supabase → Project Settings → API | URL, anon key, service role key |
| Supabase → Project Settings → General | Reference ID (usado no CLI) |
| Supabase → Authentication → Hooks | Registro do Auth Hook |
| Supabase → SQL Editor | Executar migrations e queries manuais |
| Vercel → Settings → Environment Variables | Variáveis de ambiente de produção |
| Vercel → Settings → Domains | Domínio customizado |
| GitHub → Settings → Secrets → Actions | Secrets do CI |
| Resend → Domains | Verificação de domínio para e-mail |
| Webmania → API | Token e Consumer Secret |
