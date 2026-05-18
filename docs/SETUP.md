# Setup Inicial — Logvale Devoluções

Este guia cobre tudo que você precisa configurar antes de rodar o projeto.

## Pré-requisitos

- Node.js 20 LTS ou superior
- npm 10+ ou pnpm 9+
- Conta no Supabase (plano Pro recomendado para produção)
- Conta no Vercel
- Conta na Webmania
- Conta no Resend
- Domínio próprio (opcional para dev, obrigatório para prod)

## 1. Supabase

### 1.1 Criar Projeto

1. Acesse https://supabase.com → New Project
2. Escolha região: `South America (São Paulo)` (latência mínima para BR)
3. Plano: Free para dev, Pro ($25/mês) ou Team ($599/mês) para produção
4. Anote `Project URL` e `anon key` e `service_role key`

### 1.2 Aplicar Schema

1. Abra SQL Editor no painel do Supabase
2. Cole o conteúdo de `docs/SCHEMA.sql`
3. Execute. Verifique que todas as tabelas foram criadas em Database → Tables.

### 1.3 Criar Buckets e Storage Policies

No SQL Editor do Supabase, cole e execute o conteúdo de `supabase/migrations/001_storage.sql`.

Este arquivo cria os 3 buckets privados (`box-photos`, `item-photos`, `invoice-xmls`) e todas as policies usando as funções auxiliares `is_operator()`, `is_manager()` e `is_client()` (que consultam a tabela `profiles` diretamente — sem depender de JWT claims customizados).

> **Importante:** Não use `auth.jwt() ->> 'role'` em policies de storage — o JWT padrão do Supabase não carrega claims customizados e a verificação sempre retornará NULL.

### 1.5 Criar Primeiro Manager

1. Em Authentication → Users → Add User → Send magic link
2. Após receber e fazer login, pegue o UUID do usuário
3. Em SQL Editor, execute:

```sql
insert into profiles (id, role, full_name, terms_accepted_at)
values ('<uuid-do-user>', 'manager', 'Seu Nome', now());
```

### 1.6 Habilitar pg_cron e Configurar Jobs

```sql
-- Já incluído no schema, mas confirme:
create extension if not exists pg_cron;

-- Verifique que o job está agendado:
select * from cron.job;
```

## 2. Webmania

1. Crie conta em https://webmaniabr.com
2. Configure API NFe (Consulta por Chave)
3. Anote o `Token` e `Consumer Secret`
4. Confira limites de consulta e custo por chamada

## 3. Resend

1. Crie conta em https://resend.com
2. Verifique seu domínio (instruções DNS no painel)
3. Crie API key
4. Em Domains, configure `notificacoes@logvale.com.br` (ou similar)

## 4. Variáveis de Ambiente

Crie `.env.local` na raiz do projeto:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Webmania
WEBMANIA_API_TOKEN=xxx
WEBMANIA_CONSUMER_SECRET=xxx
WEBMANIA_BASE_URL=https://api.webmaniabr.com

# Resend
RESEND_API_KEY=re_xxx
RESEND_FROM_EMAIL=notificacoes@logvale.com.br

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
NODE_ENV=development
```

Em Vercel (produção), configure as mesmas variáveis em Project Settings →
Environment Variables.

## 5. Rodar Localmente

```bash
# Clone e entre no projeto
cd logvale-devolucoes

# Instale
npm install

# Rode
npm run dev

# Acesse
open http://localhost:3000
```

Faça login com o e-mail do manager criado na seção 1.5.

## 6. Deploy no Vercel

```bash
# Instale CLI
npm i -g vercel

# Deploy
vercel
```

Ou conecte o repositório GitHub direto na interface do Vercel para deploy
automático em pushes.

### 6.1 Domínio Customizado

1. Em Vercel → Settings → Domains
2. Adicione `logvale.com.br` (ou seu domínio)
3. Configure DNS conforme instruções
4. Atualize `NEXT_PUBLIC_APP_URL` na env

## 7. Edge Functions

```bash
# Instale Supabase CLI
npm i -g supabase

# Login
supabase login

# Link com seu projeto
supabase link --project-ref <project-ref>

# Deploy functions
supabase functions deploy warning-email
supabase functions deploy photo-cleanup
# Nota: auto-decision é um job pg_cron (SQL), não uma Edge Function
```

Configure secrets das functions:

```bash
supabase secrets set RESEND_API_KEY=re_xxx
supabase secrets set NEXT_PUBLIC_APP_URL=https://logvale.com.br
```

Agende via SQL Editor:

```sql
select cron.schedule(
  'warning-email-job',
  '0 * * * *',
  $$
    select net.http_post(
      url:='https://<project>.supabase.co/functions/v1/warning-email',
      headers:='{"Authorization": "Bearer <service-role>"}'::jsonb
    );
  $$
);
```

## 8. Monitoramento

Recomendados:

- **Sentry** para erros (`@sentry/nextjs`)
- **Vercel Analytics** (built-in, free)
- **Supabase Logs** (painel)
- **Resend Logs** para entregabilidade

## 9. Checklist Pré-Produção

- [ ] HTTPS forçado (Vercel faz automaticamente)
- [ ] Domínio Resend verificado
- [ ] Política de Privacidade publicada
- [ ] Termos de Uso publicado
- [ ] DPO designado (mesmo que seja você)
- [ ] Backup do Supabase configurado (Pro plan = backups automáticos)
- [ ] Plano de incidente documentado
- [ ] Manager inicial criado
- [ ] Pelo menos 1 depositante de teste cadastrado
- [ ] Pelo menos 1 cliente de teste convidado
- [ ] Webcam testada em ambiente real do operador
- [ ] Leitor EAN testado (verificar comportamento HID)
- [ ] Edge Functions deployadas e cron agendado
- [ ] Lighthouse > 90 nas rotas principais
- [ ] Testes E2E passando

## 10. Custos Estimados (mensais, em produção)

Com volume de ~2.000 devoluções/mês:

| Serviço | Plano | Custo |
|---|---|---|
| Supabase | Pro | $25 |
| Vercel | Hobby (Free) | $0 |
| Webmania | ~2.000 consultas/mês (com cache ~50%) | ~R$ 150 |
| Resend | Free (3.000 e-mails/mês) | $0 |
| Domínio | .com.br anual | ~R$ 40 |
| **Total** | | **~R$ 300/mês** |

Se o volume crescer para mais de 10.000 devoluções/mês, considere Supabase Team e Vercel Pro.

## 11. Próximos Passos Pós-Lançamento

- Treinamento dos operadores (provavelmente 1 dia em campo)
- Onboarding white-glove dos primeiros 5 clientes
- Monitorar métricas durante primeiro mês
- Coletar feedback estruturado dos 3 perfis
- Backlog de v2: app mobile do operador, integração ERP, IA detecção avaria

---

## Suporte

Documentação interna: `/docs`
Issues: GitHub do projeto
Contato técnico: <preencher>
