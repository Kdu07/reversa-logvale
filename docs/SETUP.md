# Setup Inicial — Logvale Devoluções

Este guia cobre tudo que você precisa configurar antes de rodar o projeto localmente. Para deploy em produção, veja [DEPLOY.md](DEPLOY.md).

## Pré-requisitos

- Node.js 20 LTS ou superior
- npm 10+ ou pnpm 9+
- Supabase CLI (`npm i -g supabase`)
- Conta no Supabase (plano Free para dev, Pro para produção)
- Conta na Webmania (somente para a consulta externa de NF — integração futura; não necessária hoje)
- Conta no Resend
- Domínio próprio (opcional para dev, obrigatório para prod)

## 1. Supabase

### 1.1 Criar Projeto

1. Acesse https://supabase.com → New Project
2. Escolha região: `South America (São Paulo)` (latência mínima para BR)
3. Plano: Free para dev, Pro ($25/mês) para produção
4. Anote `Project URL`, `anon key` e `service_role key`

### 1.2 Aplicar Migrations

As migrations estão em `supabase/migrations/` e cobrem schema, storage, auth hook e funções auxiliares. Aplique com a CLI:

```bash
supabase login
supabase link --project-ref <seu-project-ref>
supabase db push
```

Verifique que as tabelas foram criadas em Database → Tables.

### 1.3 Registrar Auth Hook (passo manual obrigatório)

1. No painel do Supabase: Authentication → Hooks
2. Em **Custom Access Token Hook**, clique em Enable
3. Selecione a função `public.custom_access_token_hook`

Este hook injeta `role`, `active` e `terms_accepted_at` nos JWT claims — sem ele o middleware não consegue ler o perfil do usuário.

### 1.4 Criar Primeiro Manager

1. Authentication → Users → Add User (defina e-mail e uma senha temporária; marque o e-mail como confirmado)
2. Faça login na tela `/login` com esse e-mail e senha
3. Pegue o UUID do usuário (Authentication → Users)
4. Execute no SQL Editor:

```sql
insert into profiles (id, role, full_name, terms_accepted_at)
values ('<uuid-do-user>', 'manager', 'Seu Nome', now());
```

### 1.5 Verificar pg_cron

O job de auto-decisão (72h) é criado automaticamente pelas migrations. Confirme:

```sql
select jobname, schedule from cron.job;
-- Deve mostrar: auto-decision-job | 0 * * * *
```

## 2. Webmania (integração futura)

> **Não é necessária para rodar nem para lançar o sistema hoje.** A NF é identificada por
> parsing local da chave de acesso (CNPJ emissor, número, competência), sem consulta externa.
> Esta seção fica como referência para quando a consulta de XML/DANFE via API externa for ativada;
> nesse momento, implemente o corpo de `fetchInvoiceXml()` em `lib/integrations/webmania.ts`.

1. Crie conta em https://webmaniabr.com
2. Configure a API NFe (Consulta por Chave de Acesso)
3. No painel, acesse Configurações → API OAuth e anote as 4 credenciais:
   - Consumer Key
   - Consumer Secret
   - Access Token
   - Access Token Secret

## 3. Resend

1. Crie conta em https://resend.com
2. Verifique seu domínio (DNS TXT + DKIM no painel)
3. Crie uma API key
4. Configure o remetente: `notificacoes@seudominio.com.br`

## 4. Variáveis de Ambiente

Crie `.env.local` na raiz do projeto:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Webmania (4 credenciais OAuth — reservadas para a consulta externa futura; hoje não utilizadas)
WEBMANIA_CONSUMER_KEY=xxx
WEBMANIA_CONSUMER_SECRET=xxx
WEBMANIA_ACCESS_TOKEN=xxx
WEBMANIA_ACCESS_TOKEN_SECRET=xxx
WEBMANIA_BASE_URL=https://webmaniabr.com/api

# Resend
RESEND_API_KEY=re_xxx
RESEND_FROM_EMAIL=notificacoes@logvale.com.br

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

> Em produção, configure as mesmas variáveis em Vercel → Project Settings → Environment Variables. Veja [DEPLOY.md](DEPLOY.md) para a lista completa.

## 5. Rodar Localmente

```bash
npm install
npm run dev
# Acesse http://localhost:3000
```

Faça login com o e-mail do manager criado na seção 1.4.

## 6. Edge Functions

As Edge Functions (`warning-email` e `photo-cleanup`) já estão implementadas em `supabase/functions/`. Não são necessárias para o desenvolvimento local — só para produção.

O deploy, a configuração de secrets, o agendamento via pg_cron, o monitoramento e os testes manuais estão documentados em um único lugar: **[JOBS.md](JOBS.md)**.

## 7. Monitoramento

Recomendados:

- **Sentry** para erros (`@sentry/nextjs`, já configurado em `next.config.mjs`)
- **Vercel Analytics** (built-in, free)
- **Supabase Logs** (painel → Logs Explorer)
- **Resend Logs** para entregabilidade de e-mails

## 8. Checklist Pré-Produção

- [ ] Migrations aplicadas (`supabase db push`)
- [ ] Auth Hook registrado manualmente
- [ ] Manager inicial criado
- [ ] HTTPS ativo (Vercel faz automaticamente)
- [ ] Domínio Resend verificado
- [ ] Política de Privacidade e Termos publicados
- [ ] Backup Supabase configurado (Pro = backups automáticos)
- [ ] Pelo menos 1 depositante de teste cadastrado
- [ ] Pelo menos 1 cliente de teste convidado e logado
- [ ] Webcam testada em ambiente real do operador
- [ ] Leitor EAN testado (verificar comportamento HID)
- [ ] Edge Functions deployadas e crons agendados
- [ ] Lighthouse > 90 nas rotas principais
- [ ] Testes E2E passando

## 9. Custos Estimados (mensais, em produção)

No volume de ~2.000 devoluções/mês, o total fica em **~R$ 150/mês**. A tabela detalhada por serviço está em um único lugar — **[DEPLOY.md](DEPLOY.md)**, seção "Custos Estimados" — para não divergir entre os documentos.
