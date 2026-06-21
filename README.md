# Logvale — Gestão de Devoluções

**Plataforma web para gerenciamento de devoluções de ponta a ponta: do recebimento físico à decisão do cliente, com rastreabilidade total e conformidade LGPD.**

![Next.js](https://img.shields.io/badge/Next.js_14-black?style=flat&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat&logo=typescript&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=flat&logo=supabase&logoColor=white)
![Vercel](https://img.shields.io/badge/Vercel-black?style=flat&logo=vercel)

---

## O Problema

Operadoras logísticas recebem diariamente devoluções de mercadorias dos Correios e transportadoras em nome de seus clientes (depositantes). Sem um sistema dedicado, o processo é caótico: e-mails, planilhas, fotos via WhatsApp, prazos esquecidos. O cliente não tem visibilidade sobre o que está parado no galpão. A operadora não tem histórico. Ninguém sabe o que fazer com o pacote.

## A Solução

A Logvale centraliza todo o ciclo de vida de uma devolução em uma única plataforma, com fluxos distintos para cada ator. O operador registra o recebimento em menos de 90 segundos usando scanner EAN e webcam. O cliente visualiza cada devolução com fotos, nota fiscal e tem 72 horas para decidir o destino. O gerente acompanha tudo em tempo real.

Automações eliminam o trabalho manual: a NF-e é identificada pela própria chave de acesso (parsing local que extrai CNPJ emissor, número e competência, sugerindo o depositante); e-mails de alerta são disparados a 48h do prazo; devoluções sem resposta são decididas automaticamente. A consulta do XML via API externa é uma integração planejada. O resultado é rastreabilidade completa, do pacote ao arquivo fiscal.

---

## Sistema

### Operador — Velocidade no Galpão

O operador trabalha em desktop com leitor de código de barras USB (HID) e webcam. Um fluxo guiado de 7 etapas conduz o registro:

1. Captura da chave de acesso da NF-e (via scanner, digitação ou código postal)
2. Registro do RV (número de recebimento interno)
3. Contagem de itens
4. Fotografias da caixa (2 a 4, comprimidas automaticamente)
5. Fotografias dos itens
6. Revisão completa antes de salvar
7. Confirmação com feedback sonoro e visual

No momento da captura, a chave de acesso é interpretada localmente (sem chamada externa) para sugerir o depositante pelo CNPJ do emissor — o operador nunca espera.

### Cliente (Depositante) — Controle Total

O cliente acessa um painel com todas as devoluções aguardando decisão, com fotos, NF-e para download e contador regressivo de 72 horas. Para cada devolução, escolhe entre quatro destinos:

- **Voltar ao estoque** — devolução para o armazém do cliente
- **Armazenar para tratativas** — produto com problema a resolver
- **Descarte** — mercadoria sem valor de recuperação
- **Reembalagem** — produto íntegro, embalagem danificada

A confirmação exige upload da NF-e de devolução (quando aplicável) e uma dupla confirmação por ser irreversível. O histórico completo fica acessível em `/cliente/historico`.

### Gerente — Controle Administrativo

O gerente da Logvale tem acesso a dashboard com métricas em tempo real (total de devoluções, tempo médio de decisão, taxa de auto-decisões, pendências críticas), CRUD completo de usuários e depositantes, e visualização de todas as devoluções do sistema.

Para conformidade LGPD, o gerente pode exportar os dados de qualquer usuário em um arquivo ZIP estruturado ou anonimizar contas encerradas, preservando apenas os registros fiscais obrigatórios por lei.

---

## Funcionalidades em Destaque

- Identificação da NF-e por parsing local da chave de acesso (CNPJ emissor, número, competência); consulta do XML via API externa (Webmania) planejada, com botão de backfill em lote no painel do super
- Compressão de fotos client-side (alvo ~500 KB) antes do upload para Storage privado
- Auto-decisão após 72h via pg_cron — nenhuma devolução fica parada indefinidamente
- Alertas por e-mail a 48h do prazo com lista das devoluções pendentes
- RLS (Row Level Security) por perfil — cada cliente vê apenas seus próprios dados
- Conformidade LGPD: exportação em ZIP, anonimização com preservação fiscal, política de retenção automatizada
- Login por e-mail + senha; primeiro acesso via link de ativação (token único) que leva à criação de senha e aceite de termos
- Ciclo de vida auditável: `awaiting_decision` → `decided` → `processed`, com timestamps e responsável em cada etapa

---

## Stack

| Camada | Tecnologia |
|---|---|
| Frontend | Next.js 14 (App Router) + TypeScript |
| UI | Tailwind CSS + shadcn/ui |
| Auth | Supabase Auth (e-mail + senha; link de ativação no primeiro acesso) |
| Banco | Supabase PostgreSQL + RLS |
| Storage | Supabase Storage (privado, URLs assinadas) |
| Jobs | pg_cron + Supabase Edge Functions |
| E-mail | Resend + React Email |
| Hosting | Vercel |
| NF-e | Chave de acesso (parsing local); consulta externa planejada (Webmania) |

---

## Rodar Localmente

**Pré-requisitos:** Node.js 20 LTS+, conta no Supabase, Supabase CLI.

```bash
git clone <url-do-repo>
cd reversa-logvale
npm install
cp .env.example .env.local   # preencha as variáveis
npm run dev                  # http://localhost:3000
```

Configure o Supabase (projeto, migrations, Auth Hook e primeiro manager) seguindo o guia completo em [docs/SETUP.md](docs/SETUP.md).

A integração de e-mail é opcional em desenvolvimento (o sistema funciona sem ela). A consulta de NF-e usa a **NFEio**: na bipagem, além do parsing local da chave de acesso, o sistema baixa o XML e o DANFE (PDF) e os disponibiliza para download. Sem `NFEIO_ACCESS_KEY` a consulta fica desligada e o recebimento conclui via parsing local da chave.

## Comandos

```bash
npm run dev          # Dev server em :3000
npm run build        # Build de produção
npm run lint         # ESLint (next/core-web-vitals)
npm test             # Testes unitários (Vitest)
npm run test:ui      # Dashboard interativo de testes
npm run coverage     # Relatório de cobertura
npm run test:e2e     # Testes E2E (Playwright)
npx tsc --noEmit     # Checagem de tipos
```

---

## Documentação

| Doc | Conteúdo |
|---|---|
| [docs/PRD.md](docs/PRD.md) | Requisitos de produto, fluxos, regras de negócio e métricas |
| [docs/SETUP.md](docs/SETUP.md) | Setup local — Supabase, env vars, Auth Hook, primeiro manager |
| [docs/DEPLOY.md](docs/DEPLOY.md) | Deploy em produção (Supabase Pro + Vercel), checklist completo |
| [docs/JOBS.md](docs/JOBS.md) | Jobs agendados — pg_cron e Edge Functions |
| [docs/LGPD.md](docs/LGPD.md) | Conformidade LGPD: retenção, exportação, anonimização, incidentes |
