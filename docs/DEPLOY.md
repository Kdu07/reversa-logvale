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

### 1.3.1 URLs de redirect e validade dos links de e-mail (Auth)

No **Authentication → URL Configuration** (e refletido em `supabase/config.toml`):

1. **Site URL:** `https://<seu-dominio>` (produção) — não deixar `localhost`.
2. **Redirect URLs (allowlist):** adicione `https://<seu-dominio>/auth/callback`.
   Sem isso, os links de **redefinição de senha** (recovery) falham em produção.
3. **Email OTP expiry:** defina **86400s (24h)** em
   **Authentication → Providers → Email** (ou `[auth.email] otp_expiry`).
   Isso governa o link de **recovery**. A **ativação de conta** usa um token
   próprio (`/ativar`, tabela `activation_tokens`) que **não** depende do OTP e
   vale até a conta ser ativada.

> O link de ativação (`/ativar?token=...`) é de uso único: vale até o usuário
> ativar a conta e é invalidado a cada reenvio. Não depende da expiração do OTP.

---

### 1.4 Criar o Primeiro Manager

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

O job `auto-decision-job` já está incluído em `supabase/migrations/000_schema.sql` e é criado pelo `supabase db push`. Roda automaticamente a cada hora para marcar devoluções sem decisão após 72h.

Para verificar que foi criado corretamente:

```sql
SELECT jobname, schedule, command FROM cron.job;
```

Deve aparecer `auto-decision-job` com schedule `0 * * * *`.

> **Atenção:** `pg_cron` requer o plano **Pro ou superior** do Supabase. No Free, o job não rodará.

---

### 1.7 Fazer Deploy das Edge Functions

As Edge Functions enviam e-mails de aviso (48h) e limpam fotos antigas (1 ano). O deploy e a configuração de secrets são feitos via Supabase CLI.

➡️ **Comandos completos (deploy + secrets) em [JOBS.md](JOBS.md), seção 2.** Em resumo: `supabase functions deploy warning-email` e `photo-cleanup`, depois `supabase secrets set` para `GMAIL_OAUTH_USER`, `GOOGLE_SA_CLIENT_EMAIL`, `GOOGLE_SA_PRIVATE_KEY`, `MAIL_FROM` e `NEXT_PUBLIC_APP_URL`.

> `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` são injetados automaticamente pelo runtime das Edge Functions — **não** os configure como secret.

---

### 1.8 Agendar as Edge Functions via pg_cron

As Edge Functions precisam ser chamadas via HTTP pelo cron (`warning-email` de hora em hora; `photo-cleanup` diariamente).

➡️ **SQL de agendamento completo em [JOBS.md](JOBS.md), seção 3.** Execute-o no **SQL Editor** substituindo `<PROJECT_REF>` e `<SERVICE_ROLE_KEY>` pelos valores reais.

---

### 1.9 Configurar o envio de e-mail (SMTP)

Os e-mails da aplicação (link de ativação e avisos de pendência) são enviados via **Google Workspace com OAuth2 / Service Account** — o app usa Nodemailer (`lib/integrations/email.ts`) e o job de aviso usa a Gmail API REST na Edge Function. Como o Workspace é gerenciado **sem verificação em 2 etapas**, não há App Password: uma **Service Account** com **Domain-Wide Delegation** impersona a caixa remetente. Sem registros de DNS extras (o SPF/DKIM do Google já autentica) e com ótima entregabilidade.

**Passo a passo (etapa manual, uma vez):**

1. **Google Cloud Console:** crie/selecione um projeto, ative a **Gmail API**, crie uma **conta de serviço** (`logvale-mailer`) e gere uma **chave JSON**. Anote `client_id` (Unique ID), `client_email` e `private_key`.
2. **Admin Console** (`admin.google.com`, Super Admin): **Segurança → Controles de acesso e dados → Controles de API → Delegação em todo o domínio → Adicionar novo** → cole o **ID do cliente** (Unique ID numérico) e o escopo `https://mail.google.com/` → **Autorizar**.
3. Garanta que a caixa remetente (ex.: `cadu@logvale.com.br`) exista e esteja ativa.
4. Configure as variáveis (locais e na Vercel — ver Parte 2.2):
   - `SMTP_HOST=smtp.gmail.com`
   - `SMTP_PORT=465`
   - `MAIL_FROM=cadu@logvale.com.br`
   - `GMAIL_OAUTH_USER=cadu@logvale.com.br`
   - `GOOGLE_SA_CLIENT_ID=<Unique ID numérico>`
   - `GOOGLE_SA_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"`
5. **Edge Function** (`warning-email`): defina `GMAIL_OAUTH_USER`, `GOOGLE_SA_CLIENT_EMAIL`, `GOOGLE_SA_PRIVATE_KEY` e `MAIL_FROM` como **secrets** do Supabase (`supabase secrets set ...`) e redeploy (`supabase functions deploy warning-email`). Ver [JOBS.md](JOBS.md), seção 2.

> Sem `GOOGLE_SA_CLIENT_ID`/`GOOGLE_SA_PRIVATE_KEY`, o envio fica desligado; a criação de usuário ainda funciona e exibe o link de ativação para envio manual.

**E-mails nativos do Supabase** (recuperação de senha, confirmação de troca de e-mail) usam o SMTP configurado em **Project Settings → Authentication → SMTP Settings** — pode apontar para o mesmo `smtp.gmail.com`. Em **URL Configuration**, defina:
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
| `NFEIO_ACCESS_KEY` | `<API Key da empresa>` | Production, Preview (vazio = consulta desligada) |
| `NFEIO_BASE_URL` | `https://nfe.api.nfe.io` | (opcional — default já aplicado) |
| `SMTP_HOST` | `smtp.gmail.com` | Production, Preview |
| `SMTP_PORT` | `465` | Production, Preview |
| `MAIL_FROM` | `cadu@seudominio.com.br` | Production, Preview |
| `GMAIL_OAUTH_USER` | `cadu@seudominio.com.br` | Production, Preview |
| `GOOGLE_SA_CLIENT_ID` | `<Unique ID numérico da service account>` | Production, Preview |
| `GOOGLE_SA_PRIVATE_KEY` | `-----BEGIN PRIVATE KEY-----\n...` | Production, Preview |
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

### 3.1 NFEio (Consulta NF-e — XML + DANFE)

> Ativa no fluxo do operador: na bipagem o sistema consulta a NFEio pela chave de acesso e
> persiste o XML e o DANFE (PDF), baixáveis nos botões de download. **Opcional para o deploy:**
> sem `NFEIO_ACCESS_KEY` a consulta fica desligada — o recebimento conclui via parsing local da
> chave e o XML/PDF ficam pendentes para o painel super-only de backfill.

1. Crie conta em [nfe.io](https://nfe.io)
2. Habilite a API de **Consulta de Notas Fiscais** (productinvoices) para a empresa
3. Copie a **API Key da empresa** (enviada no header `Authorization`)
4. Configure `NFEIO_ACCESS_KEY` em Vercel Environment Variables para produção (e, se quiser
   sobrescrever a base, `NFEIO_BASE_URL`)

### 3.2 E-mail SMTP (Google Workspace via OAuth2 / Service Account)

Como `logvale.com.br` já usa Google Workspace para e-mail, o envio transacional sai pelo Google — sem registros de DNS adicionais (o SPF/DKIM do Google já autentica o domínio). Como o Workspace é gerenciado **sem verificação em 2 etapas**, a autenticação é por **Service Account com Domain-Wide Delegation** (não App Password).

1. **Google Cloud Console:** ative a Gmail API, crie uma service account e gere a chave JSON
2. **Admin Console:** autorize o Unique ID da service account com o escopo `https://mail.google.com/` (Delegação em todo o domínio)
3. Configure `SMTP_HOST`, `SMTP_PORT`, `MAIL_FROM`, `GMAIL_OAUTH_USER`, `GOOGLE_SA_CLIENT_ID`, `GOOGLE_SA_PRIVATE_KEY` no Vercel; e `GOOGLE_SA_CLIENT_EMAIL` (em vez de `GOOGLE_SA_CLIENT_ID`) nos secrets das Edge Functions (ver 1.9)

> Detalhes e passo a passo completo na seção **1.9**.

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
- [ ] Site URL + Redirect URLs de produção configurados (inclui `https://<dominio>/auth/callback`)
- [ ] Email OTP expiry definido em 24h (86400s) — links de redefinição de senha
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
- [ ] NFEio: `NFEIO_ACCESS_KEY` configurada (opcional — sem ela a consulta de XML/DANFE fica desligada)
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
| NFEio | consulta de NF-e (XML + DANFE) | conforme plano contratado |
| Resend | Free (3.000 e-mails/mês) | $0 |
| Domínio | .com.br anual | ~R$ 40/mês |
| **Total** | | **~R$ 150/mês + NFEio** |

> A NFEio é cobrada por consulta conforme o plano contratado; o XML/DANFE é deduplicado por chave de acesso (`ak/<chave>`), então NFs repetidas não geram nova consulta de armazenamento.

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
| NFEio → API Keys | API Key da empresa (`NFEIO_ACCESS_KEY`) |
