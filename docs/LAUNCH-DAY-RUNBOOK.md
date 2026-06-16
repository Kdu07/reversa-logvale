# Runbook — Launch Day (Go-Live)

> **Objetivo:** garantir que o primeiro deploy em produção entre no ar sem falhas e, se algo
> quebrar, ter um diagnóstico e correção prontos. Siga na ordem. Marque cada `[ ]` ao concluir.
>
> **Pré-requisito de leitura:** `docs/DEPLOY.md` (este runbook assume que o deploy já foi feito
> conforme aquele guia). Aqui o foco é **verificar, testar e corrigir**.

---

## Linha do tempo recomendada

| Quando | Bloco | Por quê |
|---|---|---|
| **Hoje (T‑24h)** | Bloco 1 — Itens com lead time | DNS, verificação de domínio e SMTP levam horas; não dá pra resolver de manhã |
| **Hoje (T‑24h)** | Bloco 2 — Verificação automatizada (SQL + env) | Pega config faltando antes de ter usuário real |
| **Amanhã (T‑2h)** | Bloco 3 — Smoke test funcional | Valida o fluxo ponta a ponta com dados descartáveis |
| **T‑0** | Liberar acesso aos usuários reais | Só depois que blocos 1–3 estão verdes |
| **T+0 a T+48h** | Bloco 5 — Monitoramento | Primeiras horas concentram a maioria das falhas |
| **Sempre à mão** | Bloco 4 — Playbook de falhas + Bloco 6 — Rollback | Resposta rápida quando algo quebra |

---

## Bloco 1 — Itens com lead time (FAZER HOJE, não dá pra corrigir amanhã de manhã)

Estes itens dependem de propagação externa (DNS, verificação de e-mail) que leva de minutos a 24h.
Se descobrir um problema aqui no dia do launch, **não há correção same-day**.

### 1.1 — Verificação de domínio no Resend `[ ]`

Sem isso, **login por magic link e todos os e-mails de notificação falham silenciosamente**.

1. Acesse [resend.com](https://resend.com) → **Domains**.
2. Confirme que o domínio (`seudominio.com.br`) está com status **verde / Verified**.
3. Se estiver amarelo/pendente: abra o domínio, copie os registros **TXT (SPF)**, **DKIM** e **MX**
   e cadastre no seu registrador (Registro.br). Aguarde a verificação (pode levar até 24h).
4. **Teste real:** Resend → **Emails** → envie um e-mail de teste para um endereço seu e confirme
   que chega (inclusive checando a caixa de spam).

> ⚠️ Se o domínio não verificar a tempo, o sistema **não consegue autenticar usuários por magic link**.

### 1.2 — SMTP customizado no Supabase Auth `[ ]`

O SMTP nativo do Supabase é limitado a poucos e-mails/hora e serve só para teste. Em produção,
sem SMTP próprio os logins falham sob qualquer volume.

1. Supabase → **Project Settings → Authentication → SMTP Settings**.
2. Habilite **Enable Custom SMTP** e preencha:
   - **Host:** `smtp.resend.com`
   - **Port:** `465`
   - **User:** `resend`
   - **Password:** sua `RESEND_API_KEY`
   - **Sender email:** `notificacoes@seudominio.com.br` (precisa ser do domínio verificado em 1.1)
3. Salve.
4. Supabase → **Authentication → URL Configuration**:
   - **Site URL:** `https://seudominio.com.br`
   - **Redirect URLs:** adicione `https://seudominio.com.br/auth/callback`
5. **Teste real:** na tela de login de produção, peça um magic link com um e-mail seu e confirme
   que o e-mail chega e o link redireciona corretamente para a home da role.

### 1.3 — Domínio + SSL na Vercel `[ ]`

1. Vercel → **Settings → Domains** → confirme que o domínio aparece com **Valid Configuration** e SSL ativo (cadeado).
2. Acesse `https://seudominio.com.br` no navegador e confirme que carrega com HTTPS sem aviso de certificado.
3. Confirme que `NEXT_PUBLIC_APP_URL` na Vercel aponta para o domínio **final** (e não para o `*.vercel.app`).
   Esse valor é usado nos links dos e-mails — se estiver errado, os links chegam quebrados.

### 1.4 — Credenciais Webmania em produção `[ ]`

⚠️ **Atenção crítica:** em desenvolvimento, sem credenciais, o sistema usa *mock* automaticamente —
ou seja, "funcionou no meu PC" **não prova nada**. Em produção, sem as credenciais, a consulta de NF
por chave de acesso **lança erro** (`Consulta de NF indisponível neste momento`).

1. Vercel → **Settings → Environment Variables** → confirme que os 4 valores estão preenchidos para
   **Production**: `WEBMANIA_CONSUMER_KEY`, `WEBMANIA_CONSUMER_SECRET`, `WEBMANIA_ACCESS_TOKEN`,
   `WEBMANIA_ACCESS_TOKEN_SECRET` (+ `WEBMANIA_BASE_URL`).
2. **Teste real (no smoke test, Bloco 3):** inicie um recebimento usando uma **chave de acesso de NF-e
   real** e confirme que o depositante é identificado.
3. **Contingência conhecida:** se a Webmania estiver fora do ar ou a NF não for encontrada, o operador
   **não fica travado** — ele pode registrar o recebimento usando o identificador **`código postal`**
   ou **`ilegível`**, que não chamam a Webmania. Garanta que a equipe de operação saiba disso.

### 1.5 — Plano Supabase Pro ativo `[ ]`

O plano **Free não roda `pg_cron`** (auto-decisão de 72h, e-mail de aviso, limpeza de fotos) e estoura
o storage de 1 GB em ~2 semanas no seu volume (~3 GB/mês de fotos).

1. Supabase → **Settings → Billing** → confirme **Plano Pro** ativo.
2. Confirme que **backups diários** estão habilitados (incluído no Pro).

---

## Bloco 2 — Verificação automatizada (SQL + ambiente)

### 2.1 — Health-check SQL `[ ]`

Cole o bloco abaixo no **Supabase → SQL Editor** e rode. Cada linha do resultado diz se um item
crítico está OK. **Todos devem retornar `OK`.**

```sql
-- ===== LOGVALE — HEALTH CHECK DE PRODUÇÃO =====

-- 1. Extensão pg_cron instalada
select 'pg_cron extension' as check,
       case when exists (select 1 from pg_extension where extname = 'pg_cron')
            then 'OK' else 'FALHA — pg_cron ausente (plano Free?)' end as status;

-- 2. Os 3 jobs de cron agendados
select 'cron jobs' as check,
       case when count(*) >= 3 then 'OK (' || count(*) || ' jobs)'
            else 'FALHA — esperado 3, achou ' || count(*) end as status
from cron.job
where jobname in ('auto-decision-job', 'warning-email-job', 'photo-cleanup-job');

-- 2b. Detalhe dos jobs (inspeção visual)
select jobname, schedule, active from cron.job order by jobname;

-- 3. RLS habilitado em todas as tabelas sensíveis
select 'RLS enabled' as check,
       case when bool_and(rowsecurity) then 'OK'
            else 'FALHA — alguma tabela sem RLS' end as status
from pg_tables
where schemaname = 'public'
  and tablename in ('profiles','depositors','client_depositors','invoice_cache','returns','return_photos');

-- 3b. Quais tabelas (se houver) estão sem RLS
select tablename, rowsecurity from pg_tables
where schemaname = 'public'
  and tablename in ('profiles','depositors','client_depositors','invoice_cache','returns','return_photos')
order by rowsecurity, tablename;

-- 4. Buckets de storage existem e são PRIVADOS
select 'storage buckets private' as check,
       case when count(*) = 3 and bool_and(public = false) then 'OK'
            else 'FALHA — bucket público ou faltando' end as status
from storage.buckets
where id in ('box-photos','item-photos','invoice-xmls');

-- 5. Auth Hook function existe (ativação no dashboard é manual — ver 2.2)
select 'auth hook function' as check,
       case when exists (
         select 1 from pg_proc where proname = 'custom_access_token_hook'
       ) then 'OK (lembre de ATIVAR no dashboard)' else 'FALHA — função ausente' end as status;

-- 6. Existe pelo menos um manager ativo
select 'manager exists' as check,
       case when exists (select 1 from profiles where role = 'manager' and active)
            then 'OK' else 'FALHA — nenhum manager ativo cadastrado' end as status;

-- 7. Histórico recente de execução dos jobs (deve haver execuções com status 'succeeded')
select jobname, status, start_time, return_message
from cron.job_run_details
order by start_time desc
limit 10;
```

> **Como interpretar:** se o item 5 mostrar `OK` mas você não ativou o hook no dashboard, o login ainda
> funciona (o middleware faz fallback consultando `profiles`), só fica mais lento. Ative mesmo assim
> (passo 2.2). Se o item 7 estiver vazio logo após o deploy, é normal — os jobs rodam de hora em hora.

### 2.2 — Ativar o Auth Hook (passo manual, não dá via CLI) `[ ]`

1. Supabase → **Authentication → Hooks**.
2. Localize **Custom Access Token Hook** → **Enable**.
3. Em **Hook function**, selecione `public.custom_access_token_hook`.
4. **Save**.

### 2.3 — Conferência de variáveis de ambiente na Vercel `[ ]`

Vercel → **Settings → Environment Variables**. Confirme, para **Production**:

- [ ] `NEXT_PUBLIC_SUPABASE_URL`
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [ ] `SUPABASE_SERVICE_ROLE_KEY` — **sem** prefixo `NEXT_PUBLIC_` (é server-side; se vazar pro browser, qualquer um bypassa o RLS)
- [ ] `NEXT_PUBLIC_APP_URL` = domínio final de produção
- [ ] 4 variáveis `WEBMANIA_*` + `WEBMANIA_BASE_URL`
- [ ] `RESEND_API_KEY`, `RESEND_FROM_EMAIL`
- [ ] `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_DSN` (para enxergar erros no dia 1)

> Após **qualquer** alteração de env var na Vercel é preciso **redeploy** para ela valer.

### 2.4 — Secrets das Edge Functions `[ ]`

As Edge Functions têm secrets **separados** da Vercel. Confirme via CLI:

```bash
supabase secrets list --project-ref <PROJECT_REF>
```

Devem existir: `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `NEXT_PUBLIC_APP_URL`.
(`SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` são injetados automaticamente pelo runtime.)

### 2.5 — Disparar Edge Functions manualmente (não esperar 48h pra descobrir que quebrou) `[ ]`

```bash
# warning-email
curl -X POST https://<PROJECT_REF>.supabase.co/functions/v1/warning-email \
  -H "Authorization: Bearer <SERVICE_ROLE_KEY>" -H "Content-Type: application/json"

# photo-cleanup
curl -X POST https://<PROJECT_REF>.supabase.co/functions/v1/photo-cleanup \
  -H "Authorization: Bearer <SERVICE_ROLE_KEY>" -H "Content-Type: application/json"
```

Confira a resposta (HTTP 200) e os logs em **Supabase → Edge Functions → [função] → Logs**
(filtre por `[warning-email]` / `[photo-cleanup]`).

---

## Bloco 3 — Smoke test funcional (passo a passo manual, com dados descartáveis)

Faça **antes** de liberar usuários reais. Use um depositante/cliente de teste que você possa apagar depois.

### 3.1 — Login do manager `[ ]`
1. Acesse `https://seudominio.com.br/login`.
2. Entre com as credenciais do primeiro manager (criado no deploy).
3. Confirme redirecionamento para `/admin`.

### 3.2 — Cadastro de depositante e usuários `[ ]`
1. Em `/admin`, cadastre um **depositante de teste** com um CNPJ válido (14 dígitos).
2. Cadastre um **operador de teste** e um **cliente de teste**.
3. Associe o cliente ao depositante de teste.

### 3.3 — Primeiro acesso + aceite de termos `[ ]`
1. Faça login com o cliente de teste (magic link) em uma aba anônima.
2. Confirme que o fluxo de **primeiro acesso / aceite de termos** aparece e, após aceitar, redireciona
   para `/cliente`.

### 3.4 — Fluxo completo do operador (7 passos) `[ ]`
1. Login como operador de teste.
2. Inicie um recebimento com **chave de acesso de NF-e real** → confirme que a Webmania identifica o
   depositante (valida o Bloco 1.4).
3. Fotografe caixa e itens (webcam) → confirme upload sem erro.
4. Conclua o recebimento → confirme que o `RV` é gerado.
5. **Repita** o fluxo uma vez usando identificador **`código postal`** e outra **`ilegível`**, para validar
   a contingência sem Webmania.

### 3.5 — Decisão do cliente `[ ]`
1. Login como cliente de teste → confirme que a devolução aparece em **aguardando decisão**.
2. Confirme que o cliente vê **apenas** devoluções do(s) seu(s) depositante(s) — isolamento multi-tenant.
3. Tome uma decisão (ex.: `retornar ao estoque`) → confirme que o status muda.

### 3.6 — Isolamento entre clientes (teste de segurança) `[ ]`
1. Crie um **segundo** cliente associado a um **segundo** depositante.
2. Logado como cliente A, confirme que ele **não vê** nenhuma devolução do depositante de B.
3. (Opcional, recomendado) Eu posso rodar `/security-review` no branch para uma checagem focada de RLS.

### 3.7 — Limpeza pós-teste `[ ]`
Apague (ou inative) os registros de teste antes do go-live para não poluir os relatórios.

---

## Bloco 4 — Playbook de falhas (sintoma → causa provável → correção)

| Sintoma | Causa provável | Correção |
|---|---|---|
| Magic link não chega | Domínio Resend não verificado **ou** SMTP custom não configurado | Bloco 1.1 e 1.2. Cheque **Resend → Emails** (bounce?) e logs de Auth do Supabase |
| Login redireciona pra `/login` em loop | `Redirect URLs`/`Site URL` errados no Supabase, ou `NEXT_PUBLIC_APP_URL` divergente | Alinhe os 3 valores ao domínio de produção (Bloco 1.2 / 2.3) e redeploy |
| Usuário loga mas cai em `/login` (deslogado) | `profiles` sem registro para o `auth.users.id`, ou usuário `active=false` | Inserir/ativar o profile (ver query abaixo). Middleware desloga quem não tem profile |
| Operador: "Consulta de NF indisponível" | Credenciais Webmania ausentes/erradas em produção, ou Webmania fora do ar | Verifique env `WEBMANIA_*` (2.3) + redeploy. Contingência imediata: operar via `código postal`/`ilegível` |
| Cliente não vê uma devolução existente | Devolução com `depositor_id = null` (recebida como **ilegível** e ainda não vinculada) | Operador/manager precisa vincular o depositante. **Devolução ilegível é invisível ao cliente até ser vinculada** |
| Foto não carrega / link expira | Signed URL expirou ou bucket virou público por engano | Buckets devem ser **privados** (2.1 item 4). App regenera signed URL ao recarregar |
| Auto-decisão não acontece após 72h | `pg_cron` não rodou (plano Free) ou job não agendado | Bloco 1.5 + health-check 2.1 itens 1/2. Veja `cron.job_run_details` |
| E-mail de aviso (48h) não sai | Edge Function falhando ou cron `warning-email-job` ausente | Dispare manual (2.5) e leia os logs da função |
| Erro 500 genérico em produção | Variável de ambiente faltando após deploy | Confira logs da Vercel (**Deployments → Functions → Logs**) e Sentry; valide 2.3; redeploy |

**Query — corrigir usuário sem profile (sintoma "loga e desloga"):**

```sql
-- Diagnóstico: usuários auth sem profile
select u.id, u.email
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null;

-- Correção (ajuste role/nome):
insert into public.profiles (id, role, full_name, active, terms_accepted_at)
values ('<uuid-do-auth-users>', 'client', 'Nome Completo', true, null);
```

**Query — reativar usuário inativo:**

```sql
update public.profiles set active = true where id = '<uuid>';
```

---

## Bloco 5 — Monitoramento das primeiras 48h

- [ ] **Sentry** aberto na aba — observe picos de erro nas 2 primeiras horas após liberar usuários.
- [ ] **Vercel → Deployments → [prod] → Functions/Logs** — acompanhe erros de server actions.
- [ ] **Supabase → Logs** (Auth + Postgres) — falhas de login e erros de query.
- [ ] **Após a primeira virada de hora:** rode novamente a query 7 do health-check (2.1) e confirme que
      `auto-decision-job` e `warning-email-job` executaram com `status = 'succeeded'`.
- [ ] **Storage:** Supabase → **Storage → Usage** — acompanhe o crescimento (esperado ~3 GB/mês).

---

## Bloco 6 — Rollback

| Situação | Ação |
|---|---|
| Bug no frontend/server action introduzido no último deploy | **Vercel → Deployments → [deploy anterior estável] → Promote to Production** (rollback instantâneo) |
| Variável de ambiente errada | Corrigir em **Settings → Environment Variables** → **Redeploy** |
| Migration causou problema no banco | Restaurar do **backup diário do Supabase** (Pro) — **Database → Backups**. ⚠️ Perde dados desde o último backup; só em último caso |
| Integração externa (Webmania) fora | Não precisa rollback — orientar operação a usar `código postal`/`ilegível` até normalizar |

**Quem aciona o quê (defina antes do launch):**
- Responsável técnico (deploy/rollback Vercel): __________________
- Responsável banco (Supabase/SQL): __________________
- Contato de suporte para operadores no dia: __________________

---

## Bloco 7 — Riscos conhecidos (registrar, decidir antes/depois do launch)

1. **Leitura cross-tenant no storage (hardening pós-launch).**
   As policies de leitura dos buckets são permissivas: *qualquer usuário autenticado pode ler qualquer
   objeto se souber o caminho* (`bucket_id = X and auth.uid() is not null`). Hoje isso é mitigado porque
   os caminhos não são expostos na UI e os signed URLs só são gerados para devoluções que o usuário pode
   ver (via RLS de `returns`/`return_photos`). **Risco residual:** caminhos de XML seguem o padrão
   `{chave-de-acesso}.xml` (previsível). Para LGPD, planejar endurecer as policies de `storage.objects`
   para escopar por propriedade (join `return_photos → returns → client_depositors`). **Não bloqueia o
   launch**, mas deve virar item de backlog de segurança.

2. **Devoluções ilegíveis ficam invisíveis ao cliente.**
   Devolução com `identifier_type = 'illegible'` nasce com `depositor_id = null` e, por RLS, **não aparece
   para nenhum cliente** até um operador/manager vincular o depositante. Operacionalmente correto, mas a
   equipe precisa saber que vincular essas devoluções é parte do processo (senão o cliente "não vê" e
   reclama). Considere uma fila/visão no admin para devoluções pendentes de vínculo.

3. **Fuso horário dos jobs.**
   `auto-decision-job` usa `now()` (UTC) com janela de 72h. Confirme que a janela cai onde se espera em
   relação ao horário de São Paulo — uma auto-decisão com 3h de diferença pode gerar atrito com o cliente.

---

## Resumo executivo — o que NÃO pode faltar antes de liberar usuários

1. Domínio Resend **verificado** + SMTP custom configurado (1.1, 1.2)
2. Domínio + SSL na Vercel + `NEXT_PUBLIC_APP_URL` correto (1.3)
3. Webmania testado com NF real **e** equipe ciente da contingência (1.4)
4. Supabase **Pro** com backups (1.5)
5. Health-check SQL todo **OK** + Auth Hook **ativado** (2.1, 2.2)
6. Smoke test ponta a ponta concluído, incluindo **isolamento entre clientes** (Bloco 3)
7. Sentry e logs sendo observados; plano de rollback definido (Blocos 5 e 6)
