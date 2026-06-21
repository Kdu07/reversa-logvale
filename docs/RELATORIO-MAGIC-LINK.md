# Relatório — Função de Magic Link (Ativação de Acesso)

> Data: 2026-06-21 · Escopo: fluxo de criação de usuário, geração de link de
> ativação, callback de autenticação, primeiro acesso e reenvio de link.

> **Status (2026-06-21):** os riscos **Altos (R1, R2)** e **Médios (R3–R7)**
> foram **corrigidos**. Mudanças principais: token de ativação próprio de uso
> único (`/ativar`, tabela `activation_tokens`, migration `004`) válido até a
> ativação; reenvio sensível ao estado (ativação vs. redefinição de senha);
> rota `/redefinir-senha`; rollback em `createUserAction`; allowlist de `type` no
> callback; validador de senha único; tratamento de erros no primeiro acesso.
> Os riscos **Baixos (R8–R10)** seguem em aberto (fora do escopo desta rodada).
> Detalhe por item no fim de cada risco abaixo.

---

## 1. Visão geral

O sistema **não usa magic link como método de login recorrente**. Ele é
empregado apenas como **link de ativação de conta** (primeiro acesso): o
manager cria o usuário, o sistema gera um link mágico de uso único, envia por
e-mail (ou o manager copia manualmente), e o destinatário define uma senha +
aceita os termos. A partir daí, o acesso passa a ser **e-mail + senha**
([login-form.tsx](../app/(public)/login/login-form.tsx) usa
`signInWithPassword`).

Tecnicamente, porém, o link gerado é um **OTP do tipo `magiclink`** — ou seja,
é uma autenticação *passwordless* completa, não apenas um "convite". Essa
distinção é a origem de boa parte dos riscos listados na seção 4.

### Componentes envolvidos

| Camada | Arquivo | Responsabilidade |
|---|---|---|
| Geração | [actions.ts](../app/(manager)/admin/usuarios/actions.ts) | `createUserAction`, `resendMagicLinkAction`, `buildActivationLink` |
| Envio | [email.ts](../lib/integrations/email.ts) | `sendAccountCreatedEmail` (Nodemailer/SMTP) |
| Template | [AccountCreated.tsx](../emails/AccountCreated.tsx) | E-mail com botão "Ativar meu acesso" |
| Callback | [route.ts](../app/(public)/auth/callback/route.ts) | `verifyOtp` / `exchangeCodeForSession` |
| Primeiro acesso | [page.tsx](../app/(public)/primeiro-acesso/page.tsx) | Define senha + aceite de termos |
| Roteamento | [middleware.ts](../middleware.ts) | Redireciona conforme `role` e `terms_accepted_at` |
| Claims JWT | [002_auth_hook.sql](../supabase/migrations/002_auth_hook.sql) | Injeta `role`, `active`, `terms_accepted_at` |
| Config Auth | [config.toml](../supabase/config.toml) | `enable_signup=false`, redirect URLs, `jwt_expiry` |

---

## 2. Fluxo atual passo a passo

### 2.1 Criação do usuário (`createUserAction`)

[actions.ts:104-166](../app/(manager)/admin/usuarios/actions.ts#L104-L166)

1. `assertManager()` garante que apenas managers executam.
2. `admin.auth.admin.createUser({ email, email_confirm: true })` cria o usuário
   no Auth já com e-mail confirmado.
3. `admin.auth.admin.generateLink({ type: 'magiclink', email, options: { redirectTo } })`
   gera o token.
4. `buildActivationLink()` **descarta** o `action_link` padrão e monta uma URL
   própria a partir de `properties.hashed_token`:
   `${appUrl}/auth/callback?token_hash=<hash>&type=magiclink`.
5. Se `mailEnabled`, envia o e-mail; caso contrário devolve `emailError: 'SMTP não configurado'`.
6. **Depois** insere o registro em `profiles` e, se for `client`, as relações em
   `client_depositors`.
7. Retorna `{ ok, link, emailSent, emailError }`. A UI
   ([users-table.tsx:154-156](../app/(manager)/admin/usuarios/components/users-table.tsx#L154-L156))
   exibe um modal com o link para cópia manual.

### 2.2 Por que o `action_link` padrão não é usado

O comentário em [actions.ts:34-40](../app/(manager)/admin/usuarios/actions.ts#L34-L40)
explica corretamente: o `action_link` do Supabase redireciona pelo endpoint
`/verify` do Supabase para o **fluxo PKCE**, que exige um *code verifier* no
navegador do destinatário — que nunca existiu (o link foi gerado no servidor do
admin). Por isso o app usa `token_hash` + `verifyOtp` no servidor. **Decisão
correta.**

### 2.3 Callback (`/auth/callback`)

[route.ts](../app/(public)/auth/callback/route.ts)

- Com `token_hash` + `type` → `verifyOtp({ type, token_hash })` (caminho dos
  links de ativação).
- Com `code` → `exchangeCodeForSession(code)` (caminho PKCE iniciado no
  navegador).
- Sem nenhum → redireciona para `/login?error=auth_callback_error`.
- Após autenticar: busca `profile`. Sem profile → `/`. Sem
  `terms_accepted_at` → `/primeiro-acesso`. Caso contrário → home do papel.

### 2.4 Primeiro acesso

[page.tsx](../app/(public)/primeiro-acesso/page.tsx) — server action `setupAccount`
chama `updateUser({ password })` (a sessão do magic link já está ativa, então
não há reautenticação) e grava `terms_accepted_at`. Validação mínima de senha:
`length >= 8`.

### 2.5 Reenvio (`resendMagicLinkAction`)

[actions.ts:238-271](../app/(manager)/admin/usuarios/actions.ts#L238-L271) — gera
um novo link `magiclink` para um e-mail já existente e reenvia. Útil quando o
link expira (validade de 1 hora, conforme `jwt_expiry`/OTP).

---

## 3. Pontos positivos

- ✅ **Estratégia `token_hash` + `verifyOtp` no servidor** resolve corretamente
  a incompatibilidade do PKCE com links gerados pelo admin.
- ✅ **`enable_signup = false`** ([config.toml:34](../supabase/config.toml#L34)):
  cadastro só por convite do manager.
- ✅ **Claims no JWT via Auth Hook** evitam hit no banco a cada request no
  middleware, com *fallback* para `profiles` quando o claim ainda não existe.
- ✅ **Degradação graciosa de e-mail**: se o SMTP falhar/estiver ausente, o link
  ainda é devolvido para envio manual; a criação do usuário não quebra.
- ✅ **Gate de termos** (`terms_accepted_at`) força o aceite de LGPD antes de
  liberar as áreas internas.
- ✅ **Cobertura de testes** do callback razoável
  ([auth-callback.test.ts](../__tests__/routes/auth-callback.test.ts)).
- ✅ **Mensagem clara de validade** ("válido por 1 hora") no e-mail.

---

## 4. Riscos e problemas

### 🔴 Alto

**R1 — Ordem de operações cria usuário Auth órfão sem rollback.**
Em `createUserAction`, a sequência é: cria Auth → gera link → **envia e-mail** →
insere `profiles`. Se o `insert` em `profiles` falhar (linha
[147-153](../app/(manager)/admin/usuarios/actions.ts#L147-L153)), já existe um
usuário no Auth (e possivelmente um e-mail enviado), mas **sem profile e sem
limpeza**. Consequências:
- O usuário clica no link, `verifyOtp` e `getUser` funcionam, mas como não há
  profile, o callback o joga em `/` ([route.ts:37](../app/(public)/auth/callback/route.ts#L37))
  — estado confuso e sem recuperação.
- O Auth Hook não injeta claims (sem profile), e o middleware faz *signout*.
- Recriar o usuário com o mesmo e-mail falha ("already registered"), exigindo
  intervenção manual no Supabase.
- O e-mail de ativação pode já ter sido disparado para um usuário inconsistente.

> ✅ **Resolvido.** `createUserAction` agora insere `profiles`/`client_depositors`
> e gera o token **antes** do e-mail, com `try/catch` que compensa via
> `admin.auth.admin.deleteUser(userId)` em qualquer falha (cobre `activation_tokens`
> por cascade). Coberto por teste de rollback em `__tests__/actions/users.test.ts`.

**R2 — O "link de ativação" é, de fato, um login passwordless completo.**
Como o token é `magiclink`, quem possuir o link **entra na conta sem senha**. Se
o usuário já aceitou os termos, o callback o leva direto à home do papel
([route.ts:40](../app/(public)/auth/callback/route.ts#L40)) — sem passar por
senha. Implicações:
- Interceptação do e-mail (encaminhamento, caixa compartilhada, vazamento de log)
  = **tomada de conta** dentro da janela de validade.
- `resendMagicLinkAction` funciona para **qualquer** usuário já ativo, gerando
  um caminho de login sem senha sob demanda. É restrito a managers, mas amplia a
  superfície (um manager comprometido contorna a senha de qualquer usuário).

> ✅ **Resolvido.** A ativação deixou de ser OTP passwordless: usa um token
> próprio de **uso único** (`/ativar`, `activation_tokens`) que **só funciona
> enquanto a conta não foi ativada** e morre ao ativar. O reenvio é **sensível ao
> estado** — para usuários já ativados envia **redefinição de senha**
> (`type: 'recovery'`, ~24h) que cai em `/redefinir-senha`, e não mais um login
> sem senha. Coberto em `__tests__/actions/user-actions.test.ts` e
> `__tests__/routes/ativar.test.ts`.

### 🟡 Médio

**R3 — `type` do callback é confiado sem validação.**
[route.ts:10](../app/(public)/auth/callback/route.ts#L10) faz
`searchParams.get('type') as EmailOtpType` e repassa direto a `verifyOtp`. Ainda
que o token precise ser válido, não há *allowlist* (ex.: aceitar só `magiclink`
/ `recovery` / `email`). Vale restringir explicitamente.

> ✅ **Resolvido.** O callback valida `type` contra `ALLOWED_TYPES`
> (`magiclink`, `recovery`) antes de `verifyOtp`; valor fora da lista redireciona
> para `/login?error=auth_callback_error`. Coberto em `auth-callback.test.ts`.

**R4 — `redirectTo` de produção depende de configuração externa não versionada.**
`generateLink` recebe `redirectTo: ${appUrl}/auth/callback`, que precisa estar
em `additional_redirect_urls`. O [config.toml:30](../supabase/config.toml#L30) só
lista `http://localhost:3000/...`. Em produção, se o domínio não for adicionado
no painel, a geração/redirect falha silenciosamente para o usuário final. É um
passo manual frágil — deveria estar documentado em checklist de deploy.

> ✅ **Resolvido (documentação).** `docs/DEPLOY.md` ganhou a seção 1.3.1 (Site
> URL, Redirect URLs e OTP expiry 24h) e itens no checklist final; o
> `config.toml` foi comentado. A ativação não depende mais de `redirectTo` do
> Supabase (usa `/ativar`); o `redirectTo` importa só para o recovery.

**R5 — Caminho PKCE (`code`) é essencialmente código morto.**
Nenhum ponto do app chama `signInWithOtp` no navegador, então o ramo
`exchangeCodeForSession` ([route.ts:21-23](../app/(public)/auth/callback/route.ts#L21-L23))
nunca é exercitado em produção. Não é um bug, mas é superfície a mais para
manter/testar; convém documentar a intenção (defensivo) ou remover.

> ✅ **Resolvido (documentação).** O ramo `code` foi mantido como defensivo, com
> comentário explícito no callback de que nenhum fluxo browser-initiated o usa
> hoje.

**R6 — Validação de senha fraca e duplicada.**
Mínimo de 8 caracteres, sem regra de complexidade, verificado em dois lugares
(client [set-password-form.tsx:42](../app/(public)/primeiro-acesso/set-password-form.tsx#L42)
e server [page.tsx:20](../app/(public)/primeiro-acesso/page.tsx#L20)). O server
apenas faz `return` silencioso em senha inválida (sem feedback de erro), e não há
checagem de senha vazada/comum.

> ✅ **Resolvido (parcial, conforme decisão).** Validação unificada em
> `lib/validation/password.ts` (`validatePassword`), usada por client e server no
> primeiro acesso e na redefinição. Regra mantida em 8 caracteres **sem**
> complexidade (decisão de produto); o feedback de erro deixou de ser silencioso.
> Coberto em `__tests__/lib/password.test.ts`.

**R7 — `setupAccount` ignora falhas de `updateUser`/`update`.**
[page.tsx:26-30](../app/(public)/primeiro-acesso/page.tsx#L26-L30): nem
`updateUser({ password })` nem o `update` de `terms_accepted_at` têm seus erros
verificados. Se a senha não for definida mas `terms_accepted_at` gravar, o
usuário fica "ativo" sem senha utilizável — e o magic link já expirou.

> ✅ **Resolvido.** `setupAccount` (e o novo `resetPassword`) usam `useFormState`
> e retornam `{ error }`: erros de `updateUser` **e** do `update` de
> `terms_accepted_at` são verificados e exibidos no formulário em vez do `return`
> silencioso. A ordem grava a senha antes dos termos; ao concluir,
> `markActivationTokenUsed` encerra o token.

### 🟢 Baixo

**R8 — Tokens em URL aparecem em logs/histórico/referrer.**
Risco inerente a magic links (`token_hash` na query string). Mitigado pela
validade curta, mas vale garantir que logs de servidor/CDN não retenham a query
e que o callback redirecione (já faz `302`, bom — o token não fica na barra).

**R9 — Sem trilha de auditoria.**
Geração e reenvio de links não são registrados (quem gerou, para quem, quando).
Relevante para LGPD e para investigar abusos.

**R10 — Reuso do link até expirar.**
`verifyOtp` consome o OTP, mas múltiplas chamadas a `generateLink` (ex.: criação
+ reenvio) podem deixar mais de um token válido simultaneamente até o
`jwt_expiry`. Não há invalidação explícita do link anterior ao reenviar.

---

## 5. Recomendações priorizadas

### Prioridade 1 (corrigir antes de produção)

1. **Inverter a ordem em `createUserAction` e adicionar compensação (R1).**
   Inserir `profiles` (e `client_depositors`) **antes** de gerar o link e enviar
   o e-mail. Em caso de falha posterior, executar
   `admin.auth.admin.deleteUser(userId)` para não deixar usuário Auth órfão.
   Idealmente encapsular numa função/transação lógica com `try/catch` de
   rollback explícito.

2. **Tratar o magic link como ativação de uso único, não login recorrente (R2).**
   - Não permitir reenvio (`resendMagicLinkAction`) para usuários que **já
     aceitaram os termos** (já têm senha). Para esses, o caminho correto é
     "esqueci a senha" (`type: 'recovery'`), não `magiclink`.
   - Considerar reduzir a janela de validade do link de ativação se o produto
     permitir (OTP expiry dedicado).

3. **Verificar erros em `setupAccount` (R7)** e dar feedback ao usuário quando
   `updateUser`/`update` falharem (não fazer `return` silencioso).

### Prioridade 2

4. **Restringir `type` no callback a uma allowlist (R3).**
5. **Documentar/automatizar os `additional_redirect_urls` de produção (R4)** num
   checklist de [DEPLOY.md](DEPLOY.md).
6. **Endurecer a política de senha (R6):** complexidade mínima e/ou checagem de
   senha comum; unificar a regra em um único validador compartilhado.

### Prioridade 3

7. **Adicionar auditoria (R9):** log estruturado em geração/reenvio (ator,
   alvo, timestamp).
8. **Decidir sobre o ramo PKCE (R5):** documentar como defensivo ou remover.
9. **Revisar retenção de query string com token em logs/CDN (R8).**

---

## 6. Resumo executivo

A implementação está **funcionalmente correta e bem pensada** na parte mais
difícil (o uso de `token_hash` + `verifyOtp` para contornar o PKCE de links
server-side). Os principais riscos são de **robustez transacional** (usuário Auth
órfão sem rollback — **R1**) e de **modelo de segurança** (o link de ativação é,
na prática, um login passwordless reutilizável via reenvio — **R2**). Endereçar
esses dois itens, mais o tratamento de erros do primeiro acesso (**R7**), eleva
significativamente a confiabilidade e a postura de segurança do fluxo.
