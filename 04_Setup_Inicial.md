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
2. Cole o conteúdo de `02_Schema_Supabase.sql`
3. Execute. Verifique que todas as tabelas foram criadas em Database → Tables.

### 1.3 Criar Buckets de Storage

Em Storage → Create new bucket, crie 3 buckets PRIVADOS:

- `box-photos`
- `item-photos`
- `invoice-xmls`

Para cada bucket, vá em Configuration e desabilite "Public bucket".

### 1.4 Storage Policies

No SQL Editor, execute para CADA bucket:

```sql
-- Operadores e managers fazem upload e leitura
create policy "operators upload to box-photos"
  on storage.objects for insert
  with check (
    bucket_id = 'box-photos'
    and (auth.jwt() ->> 'role')::text in ('operator', 'manager')
  );

create policy "authenticated read box-photos"
  on storage.objects for select
  using (bucket_id = 'box-photos' and auth.uid() is not null);

-- Repita para item-photos e invoice-xmls
-- Para invoice-xmls, clientes também precisam INSERT (NF de devolução)
create policy "clients upload return invoices"
  on storage.objects for insert
  with check (
    bucket_id = 'invoice-xmls'
    and auth.uid() is not null
  );
```

Ajuste conforme necessidade. Em produção, considere policies mais granulares
(verificar se o cliente é dono do return antes de permitir upload).

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
supabase functions deploy auto-decision
supabase functions deploy warning-email
supabase functions deploy photo-cleanup
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

Com volume de ~2000 devoluções/dia:

| Serviço | Plano | Custo |
|---|---|---|
| Supabase | Team | $599 |
| Vercel | Pro | $20 |
| Webmania | Por uso (~60k consultas/mês com cache 50%) | ~R$ 1500 |
| Resend | Pro | $20 |
| Domínio | .com.br anual | ~R$ 40 |
| **Total** | | **~R$ 4500/mês** |

Em volumes menores, Supabase Pro ($25) e Vercel Free são suficientes.

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
