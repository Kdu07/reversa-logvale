# PRD — Sistema Logvale de Gestão de Devoluções

**Versão:** 1.0 | **Status:** Implementado — v1.0

## 1. Visão Geral

### 1.1 Contexto
A Logvale processa devoluções de mercadorias em nome de clientes (depositantes).
Este sistema substitui processo manual por plataforma web unificada.

### 1.2 Personas
- **Operador (`operator`):** Funcionário Logvale. Desktop com webcam USB e leitor
  EAN USB-HID. Alto volume diário. UX prioriza velocidade.
- **Cliente (`client`):** Empresa depositante. Decide destino de cada devolução.
  Pode ter múltiplos CNPJs vinculados.
- **Gerente (`manager`):** Admin Logvale. CRUD de usuários, dashboard, onboarding
  white-glove de clientes.

### 1.3 Stack Técnica
| Camada | Tecnologia |
|---|---|
| Frontend | Next.js 14 (App Router) + TypeScript |
| UI | Tailwind CSS + shadcn/ui |
| Auth | Supabase Auth (magic link) |
| BD | Supabase PostgreSQL com RLS |
| Storage | Supabase Storage |
| Jobs | Supabase Edge Functions + pg_cron |
| E-mail | Resend |
| Hosting | Vercel |
| API NF | Webmania |
| Idioma/Fuso | PT-BR / America/Sao_Paulo |

### 1.4 Identidade Visual
- **Logo:** Logvale (`/public/logo.png`)
- **Primary:** `#08366D` (azul) — botões, header, links
- **Accent:** `#F12D46` (vermelho) — alertas, destrutivo
- **Fonte:** Roboto (Google Fonts) — pesos 400, 500, 700
- **Cores de decisão:**
  - Verde `#10B981` — "Voltar pro Estoque"
  - Laranja `#F59E0B` — "Armazenar para Tratativas"
  - Vermelho `#F12D46` — "Descarte"
  - Azul `#08366D` — "Reembalagem"

## 2. Modelo de Domínio

### 2.1 Entidades
- **User:** role enum (`operator`, `client`, `manager`)
- **Depositor:** CNPJ + razão social
- **ClientDepositor:** N:N entre clientes e depositantes
- **Return:** entidade central com ciclo de vida
- **ReturnPhoto:** fotos vinculadas (caixa ou item)
- **InvoiceCache:** cache de NFs Webmania

### 2.2 Ciclo de Vida do Return
```
[awaiting_decision] → [decided] → [processed]
        │                ↑
        │  (após 72h)    │
        └──auto──────────┘
```

| Status | Descrição |
|---|---|
| `awaiting_decision` | Recebimento concluído, aguarda cliente |
| `decided` | Cliente ou sistema decidiu, aguarda tratativa |
| `processed` | Tratativa concluída |

### 2.3 Decisões
| Decisão | Cor | NF devolução? |
|---|---|---|
| `return_to_stock` | Verde | Sim |
| `store_for_handling` | Laranja | Não |
| `discard` | Vermelho | Sim |
| `repackage` | Azul | Sim |

Cada decisão registra `decided_by_type`: `client` ou `auto`.

## 3. Requisitos Funcionais

### RF1 — Autenticação
- RF1.1 Login via magic link (Supabase Auth)
- RF1.2 Sessão persistente, refresh automático
- RF1.3 Cada usuário tem exatamente uma role
- RF1.4 RLS garante isolamento entre clientes
- RF1.5 Operadores e gerentes acessam todos dados (com permissões diferentes)
- RF1.6 Acesso não autorizado redireciona para tela apropriada da role

### RF2 — Onboarding Cliente (White Glove)
- RF2.1 Apenas gerente cria cliente
- RF2.2 Gerente preenche: nome, e-mail, telefone, depositantes vinculados
- RF2.3 Cadastro inline de novo depositante (CNPJ + razão social)
- RF2.4 Magic link disparado automaticamente
- RF2.5 Aceite de Termos no primeiro login

### RF3 — Recebimento (Operador) — Fluxo Sequencial 7 Etapas

**Etapa 1: Captura da Chave de Acesso (com fallback)**
1. Bipa EAN da NF (44 dígitos = chave de acesso) → consulta Webmania
2. Se falha leitor: digita à mão
3. Se NF ilegível: bipa Código Postal
4. Se falha: digita Código Postal
5. Se nada: clica "Ilegível" → gera placeholder único

**Etapa 2: RV** — operador cola RV pré-impresso e bipa

**Etapa 3: Número de Itens** — inteiro positivo

**Etapa 4: Fotos da Caixa (2-4 fotos)**
- Webcam via `getUserMedia`
- Compressão client-side (~500KB JPEG)
- Pré-visualização e descarte
- Botão "Próximo" só ativa com mínimo 2

**Etapa 5: Fotos dos Itens (1-5 fotos)** — mesmas regras

**Etapa 6: Revisão** — todos dados antes de concluir

**Etapa 7: Conclusão**
- Cria `Return` status `awaiting_decision`, `received_at = now()`
- Associa ao depositante (CNPJ emissor da NF)
- Redireciona para tela inicial

**Auxiliares:**
- Indicador "Etapa X de 7" no topo
- Botão "Voltar" preserva dados
- Beep + flash verde no sucesso, beep duplo + flash vermelho no erro
- Auto-foco no input ativo

### RF4 — Decisão (Cliente)

**RF4.1** Tabela com devoluções `awaiting_decision` dos depositantes vinculados.

**RF4.2 Colunas:**
| Coluna | Conteúdo |
|---|---|
| Data Recebimento | dd/mm/aaaa HH:mm |
| Identificador | Chave NF ou Código Postal (com tag) |
| NF (XML) | Botão download |
| RV | Código |
| Nº Itens | Número |
| Fotos Caixa | Thumbnail; hover/tap abre galeria |
| Fotos Itens | Thumbnail; hover/tap abre galeria |
| Decisão | 4 botões coloridos |
| Tempo Restante | Contador até auto-decisão (72h) |

**RF4.3 Filtros:** depositante, data, status

**RF4.4 Confirmação Dupla:**
- 1º clique abre modal com:
  - Decisão escolhida em destaque (cor + nome)
  - Aviso "Esta decisão é irreversível"
  - Resumo da devolução
  - Para verde/azul/vermelho: upload obrigatório XML NF devolução
  - Botão "Confirmar" desabilitado por 2s
- 2º clique executa definitivamente

**RF4.5 Pós-decisão:**
- Linha some da listagem padrão
- Acessível em /cliente/historico
- Cliente NÃO vê se foi processado

**RF4.6 Auto-decisão 72h:**
- Status `awaiting_decision` + `received_at < now() - 72h` → `store_for_handling`
- Job a cada 1h via cron
- Diferenciação visual no histórico

**RF4.7 Aviso 24h:**
- `received_at < now() - 48h` E status `awaiting_decision` E `warning_sent_at IS NULL`
- Dispara e-mail uma vez, marca `warning_sent_at`

### RF5 — Tratativa (Operador)

**RF5.1** Tela /operador/tratativas com status `decided`

**RF5.2 Colunas:**
- RV (busca rápida com auto-foco — operador bipa RV da caixa)
- Decisão (cor + ícone)
- Indicador "auto" se decisão foi automática
- Data decisão
- Cliente / Depositante
- "Ver detalhes" abre modal com fotos, NF, RV

**RF5.3 Conclusão:**
- "Concluir" abre modal simples (1 etapa, sem delay)
- Atualiza para `processed`, `processed_at`, `processed_by`
- Linha some

**RF5.4** Lista carrega no page load (sem realtime). Indicador "X pendentes".

### RF6 — Administração (Gerente)

**RF6.1 CRUD Usuários:**
- Lista todos com filtro por role
- Criar (escolhe role; se cliente, vincula depositantes)
- Editar (nome, telefone, depositantes — não e-mail/role)
- Desativar (soft delete `active = false`)
- Reenviar magic link

**RF6.2 CRUD Depositantes:**
- Lista, criar, editar (CNPJ, razão social)
- Mostra clientes vinculados

**RF6.3 Dashboard:**
- Total devoluções (hoje/7d/30d/custom)
- Distribuição por status (pizza)
- Distribuição por decisão (barras)
- Tempo médio recebimento → decisão
- Tempo médio decisão → processamento
- Taxa de auto-decisões (%)
- Top 10 clientes por volume
- Devoluções pendentes >48h (lista alerta)

**RF6.4 Visualização:** todos returns, read-only, com reverter status excepcional

**RF6.5 LGPD:**
- "Exportar dados de [usuário]" → ZIP com JSON
- "Anonimizar [usuário]" → substitui pessoais, mantém fiscais

### RF7 — E-mails
Apenas três tipos:
1. Magic link de login (Supabase nativo)
2. Notificação de nova conta (após criação pelo gerente)
3. Aviso 24h pendente

Templates com identidade Logvale.

### RF8 — LGPD
- RF8.1 Política em /privacidade
- RF8.2 Termos em /termos
- RF8.3 Aceite no primeiro login com timestamp
- RF8.4 Exportação por solicitação
- RF8.5 Anonimização preservando fiscais
- RF8.6 Retenção:
  - Cadastrais: ativo + 5 anos
  - NFs: 5 anos
  - Fotos: 1 ano após `processed_at`
  - Logs: 6 meses
- RF8.7 Job mensal limpa fotos antigas

## 4. Não Funcionais

### RNF1 Performance
- Paginação 50/página
- TTI < 3s em 4G
- Compressão fotos client-side
- Cache de NF

### RNF2 Disponibilidade — 99.9% (Supabase Pro)

### RNF3 Segurança
- HTTPS obrigatório
- RLS em tabelas sensíveis
- Magic link expira 10min
- Rate limiting
- Validação de XML

### RNF4 Compatibilidade
- Chrome/Edge/Firefox 110+, Safari 16+
- Operador: desktop only
- Cliente/Gerente: responsivo

### RNF5 Acessibilidade — WCAG 2.1 AA

### RNF6 i18n — strings em /lib/i18n/pt-BR.ts

## 5. Integrações

### 5.1 Webmania
- Credenciais OAuth via env: `WEBMANIA_CONSUMER_KEY`, `WEBMANIA_CONSUMER_SECRET`, `WEBMANIA_ACCESS_TOKEN`, `WEBMANIA_ACCESS_TOKEN_SECRET`
- Retry 3x com backoff
- Cache em `invoice_cache` (TTL infinito)
- Fallback: prossegue e tenta em background

### 5.2 Resend
- API key via env `RESEND_API_KEY`
- Domínio verificado: `notificacoes@logvale.com.br`
- React Email components

### 5.3 Supabase Buckets
- `box-photos`, `item-photos`, `invoice-xmls`

### 5.4 Edge Functions
- `auto-decision-job` — a cada 1h
- `warning-email-job` — a cada 1h
- `photo-cleanup-job` — 1x ao dia

## 6. Estrutura de Telas

### Públicas
- `/login`, `/auth/callback`, `/privacidade`, `/termos`

### Operador (`/operador/*`)
- `/operador` — home com botões "Novo Recebimento" e "Tratativas"
- `/operador/recebimento` — fluxo 7 etapas
- `/operador/tratativas` — lista decididas

### Cliente (`/cliente/*`)
- `/cliente` — pendentes de decisão
- `/cliente/historico` — decididas
- `/cliente/perfil`

### Gerente (`/admin/*`)
- `/admin` — dashboard
- `/admin/usuarios` — CRUD
- `/admin/depositantes` — CRUD
- `/admin/devolucoes` — visão geral

## 7. Métricas de Sucesso
- Tempo recebimento: < 90s
- Decisão manual: > 70%
- Decisão cliente: < 24h
- Erro Webmania: < 5%
- Disponibilidade: > 99.9%

## 8. Roadmap (Concluído — v1.0)

> Todas as fases abaixo foram concluídas. Mantido como registro histórico.

| Fase | Duração | Entregáveis |
|---|---|---|
| 1. Fundação | 1-2 sem | Setup, auth, schema, RLS, layout |
| 2. Recebimento | 1-2 sem | Fluxo operador |
| 3. Decisão Cliente | 1 sem | Tabela, modais, upload |
| 4. Tratativa | 3-5d | Lista e conclusão |
| 5. Admin | 1 sem | CRUD, dashboard |
| 6. Jobs | 3-5d | Cron jobs |
| 7. LGPD | 3-5d | Política, exportação |
| 8. Hardening | 1 sem | Testes, edge cases |

**Total: 8-12 semanas**

## 9. Fora de Escopo V1
- App nativo, multi-idioma, chat interno, push, PDFs, ERP, IA detecção avaria, 2FA
