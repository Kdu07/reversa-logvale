# Plano de Prompts — Construção do Logvale

Este documento contém prompts prontos organizados por fase, para serem usados em Lovable e Claude Code (ou Antigravity). Cada prompt assume que o PRD (`01_PRD_Logvale.md`) e o Schema (`02_Schema_Supabase.sql`) estão disponíveis como contexto.

## Estratégia Geral

**Fase 0 (Lovable):** prototipar 3 telas-chave para validar UX. Não construir o sistema final no Lovable.

**Fase 1+ (Claude Code):** construir o sistema real com base no protótipo validado.

**Como dar contexto às IAs:**
- No Claude Code: rode `claude` no diretório do projeto e use `/init` para criar `CLAUDE.md`. Cole o PRD inteiro no `CLAUDE.md` ou em `docs/PRD.md`.
- No Lovable: cole as seções relevantes do PRD diretamente no prompt.
- No Antigravity: use a feature de "context files" e adicione o PRD e Schema.

---

## FASE 0 — Prototipagem no Lovable

Objetivo: validar UX das 3 telas mais críticas antes de comprometer com o stack final.

### Prompt 0.1 — Setup inicial Lovable

```
Crie um app web em React + TailwindCSS chamado "Logvale Devoluções" para
prototipagem de UX.

IDENTIDADE VISUAL:
- Nome: Logvale
- Cor primária: #08366D (azul corporativo)
- Cor de destaque: #F12D46 (vermelho)
- Fonte: Roboto (Google Fonts), pesos 400, 500 e 700
- Logo: vou fazer upload depois; por enquanto use texto "LOGVALE" estilizado
  com a letra "G" em vermelho #F12D46 e o restante em azul #08366D

ESTRUTURA:
- Crie 3 rotas: /operador/recebimento, /cliente, /admin
- Header fixo com logo à esquerda, nome do usuário e botão sair à direita
- Layout limpo, profissional, com bastante espaço em branco
- Use componentes shadcn/ui

Não implemente lógica de backend. Use dados mockados.

Por enquanto, crie apenas a estrutura de navegação e um layout base. Vou pedir
cada tela em detalhe nos próximos prompts.
```

### Prompt 0.2 — Tela do Operador (Recebimento)

```
Implemente a tela /operador/recebimento como um fluxo sequencial de 7 etapas.

CONTEXTO DE USO:
- Operador trabalha em desktop com webcam USB e leitor de código de barras
  USB-HID (que se comporta como teclado, envia Enter ao final).
- Alta velocidade e simplicidade são prioridade. Cada etapa tem foco automático
  no input ativo.
- Indicador "Etapa X de 7" no topo.

ETAPAS:

Etapa 1 — Captura da Chave de Acesso (com fallback):
- Input grande com label "Bipe a chave de acesso (44 dígitos)"
- Auto-foco. Aceita 44 dígitos numéricos. Ao receber 44 caracteres + Enter,
  avança automaticamente.
- Botão "Não consigo bipar — digitar à mão" abre input manual.
- Botão "NF ilegível — bipar Código Postal" muda input para Código Postal.
- Dentro do Código Postal: mesma lógica de fallback (bipar / digitar / ilegível).
- Se "Ilegível" for clicado: botão grande vermelho confirma e gera placeholder.
- Feedback visual: flash verde no sucesso, flash vermelho no erro. Beep sonoro.

Etapa 2 — RV:
- Input "Bipe o RV". Aceita string. Mesmo padrão de auto-foco.

Etapa 3 — Número de Itens:
- Input numérico. Inteiro positivo.

Etapa 4 — Fotos da Caixa (2 a 4):
- Preview da webcam (placeholder mock por enquanto).
- Botão grande "Capturar Foto".
- Grid abaixo mostrando fotos capturadas (com botão X para descartar).
- Botão "Próximo" desabilitado se < 2 fotos.

Etapa 5 — Fotos dos Itens (1 a 5):
- Mesmo padrão da etapa 4. Mínimo 1 foto.

Etapa 6 — Revisão:
- Mostra todos dados capturados em cards: chave/postal, RV, nº itens,
  thumbnails das fotos.
- Botão "Editar" em cada seção volta para etapa correspondente.

Etapa 7 — Conclusão:
- Botão grande verde "Concluído".
- Após clicar: tela de sucesso com check animado, e após 2s redireciona
  para /operador/recebimento (fresh).

EXTRAS:
- Botão "Voltar" em cada etapa preserva dados.
- Botão "Cancelar" no canto superior direito (com confirmação).
- Animação de transição entre etapas (slide horizontal).
```

### Prompt 0.3 — Tela do Cliente

```
Implemente a tela /cliente como uma tabela rica de devoluções pendentes
de decisão.

DADOS MOCKADOS:
Crie 8 devoluções de exemplo com mistura de:
- 5 com chave de acesso
- 2 com código postal
- 1 ilegível
- Datas variando de 2h atrás até 70h atrás (para testar contador)
- 2-4 fotos da caixa cada (use imagens placeholder do Unsplash de caixas
  de papelão)
- 1-5 fotos de itens cada (placeholder Unsplash de produtos genéricos)

COLUNAS DA TABELA:
1. Data Recebimento (formato dd/mm/aaaa HH:mm)
2. Identificador (chave NF ou Código Postal, com tag colorida indicando tipo)
3. NF (botão "Baixar XML" — pode ser mock)
4. RV
5. Nº Itens
6. Fotos Caixa (thumbnail; hover abre galeria em popover)
7. Fotos Itens (thumbnail; hover abre galeria em popover)
8. Decisão: 4 botões coloridos lado a lado:
   - Verde "Voltar pro Estoque" (#10B981)
   - Laranja "Armazenar p/ Tratativas" (#F59E0B)
   - Vermelho "Descarte" (#F12D46)
   - Azul "Reembalagem" (#08366D)
9. Tempo Restante: contador regressivo até completar 72h desde recebimento.
   Vermelho se < 24h, amarelo se < 48h, normal acima.

FILTROS NO TOPO:
- Seletor de depositante (mock: 2 depositantes)
- Range de data
- Toggle "Mostrar histórico" (alterna entre pendentes e decididas)

MODAL DE CONFIRMAÇÃO (ao clicar em decisão):
- Overlay escuro
- Card centralizado com:
  - Cor da decisão escolhida em destaque (header colorido com nome da decisão)
  - Texto: "Esta decisão é IRREVERSÍVEL"
  - Resumo da devolução (RV, identificador, fotos miniatura)
  - Para verde/azul/vermelho: campo de upload de XML obrigatório (drag and drop)
  - Para laranja: sem upload
  - Botão "Confirmar Decisão" (DESABILITADO POR 2 SEGUNDOS após abertura,
    mostra contador 2s → 1s → ativa)
  - Botão "Cancelar"

ALERTA NO TOPO DA PÁGINA:
- Banner discreto: "ℹ️ Devoluções sem decisão em 72h são automaticamente
  armazenadas para tratativas."
```

### Prompt 0.4 — Tela do Gerente (Dashboard)

```
Implemente a tela /admin como um dashboard executivo para o gerente.

LAYOUT:
- Sidebar à esquerda com itens: Dashboard, Usuários, Depositantes, Devoluções
- Conteúdo principal à direita

DASHBOARD (página inicial):
Use dados mockados realistas (números de centenas/milhares).

Seção 1 — Cards de Métricas (grid 4 colunas):
- Devoluções Hoje (número grande + variação % vs ontem)
- Pendentes de Decisão (número + alerta se há >48h pendentes)
- Tempo Médio de Decisão (em horas)
- Taxa de Auto-decisões (%)

Seção 2 — Gráficos (grid 2 colunas):
- Pizza: distribuição por status (awaiting_decision, decided, processed)
- Barras: distribuição por decisão (4 cores correspondentes)

Use Recharts para os gráficos.

Seção 3 — Tabela "Top 10 Clientes por Volume":
- Nome do cliente, depositantes, total devoluções, % auto-decisões

Seção 4 — Lista de Alertas:
- "Devoluções pendentes há mais de 48h"
- Cards horizontais com: cliente, RV, tempo decorrido, link "Ver detalhes"

FILTRO GLOBAL DE PERÍODO no topo:
- Botões: Hoje, 7 dias, 30 dias, Customizar
- Atualiza todas as métricas

VISUAL:
- Use a paleta Logvale (#08366D primário, #F12D46 destaque)
- Cards com sombra suave
- Tipografia Roboto
- Espaçamento generoso
```

### Prompt 0.5 — Refinar e Validar

```
Revise as 3 telas que construímos e me dê uma análise crítica de UX:

1. O fluxo do operador é rápido o suficiente para alguém processando 100+
   devoluções por dia? Onde há atrito desnecessário?
2. A tabela do cliente é fácil de escanear visualmente? As decisões estão
   claras o bastante?
3. O dashboard do gerente comunica as métricas certas para tomada de decisão?

Sugira 5 melhorias específicas e implemente as 2 mais impactantes.
```

---

## FASE 1 — Setup do Projeto Real (Claude Code)

### Prompt 1.1 — Inicialização

```
Vou construir um sistema web profissional chamado Logvale para gestão de
devoluções logísticas. Tenho dois documentos de referência que devem
governar todas as decisões: docs/PRD.md (requisitos completos) e
docs/SCHEMA.sql (schema do banco).

Antes de começar a codificar, leia esses dois arquivos completamente.
Depois:

1. Inicialize um projeto Next.js 14 com App Router, TypeScript e Tailwind CSS.
2. Configure shadcn/ui.
3. Configure ESLint e Prettier com regras estritas.
4. Crie estrutura de pastas:
   /app
     /(public)/login, /(public)/auth/callback
     /(operator)/operador
     /(client)/cliente
     /(manager)/admin
     /api
   /components/ui (shadcn)
   /components/shared
   /lib (helpers, supabase client, i18n)
   /lib/supabase (client, server, middleware)
   /lib/i18n/pt-BR.ts
   /types
   /docs (PRD.md, SCHEMA.sql, este arquivo)
5. Configure .env.example com todas variáveis necessárias.
6. Configure tailwind.config.ts com:
   - Cores: primary (#08366D), accent (#F12D46), decision-green (#10B981),
     decision-orange (#F59E0B), decision-red (#F12D46), decision-blue (#08366D)
   - Fonte Roboto via next/font/google
7. Crie layout raiz com Roboto aplicada e header básico (logo placeholder
   e botão sair).
8. Crie middleware.ts com verificação de autenticação básica via Supabase.

Liste o que foi criado ao final. Não avance para próximas funcionalidades —
quero validar essa base antes.
```

### Prompt 1.2 — Supabase e Auth

```
Configure a integração com Supabase:

1. Instale @supabase/supabase-js e @supabase/ssr.
2. Crie /lib/supabase/client.ts (browser), /lib/supabase/server.ts
   (server actions/components), /lib/supabase/middleware.ts.
3. Implemente fluxo de magic link:
   - /app/(public)/login: input de email, botão "Receber link", validação
   - /app/(public)/auth/callback: processa code do magic link e cria sessão
4. Implemente helper getCurrentUser() no server que retorna user + profile
   (com role).
5. Atualize middleware.ts para:
   - Redirecionar não autenticados para /login
   - Redirecionar autenticados de /login para a home da role deles
   - Bloquear cross-role: cliente não acessa /admin, operador não acessa
     /cliente, etc.
6. Crie página /app/page.tsx que redireciona para /operador, /cliente
   ou /admin conforme role.

Use Server Components sempre que possível. Server Actions para mutations
de auth.

Use o schema fornecido em docs/SCHEMA.sql para confirmar a estrutura da
tabela profiles.
```

### Prompt 1.3 — Aplicar Schema no Supabase

```
Já tenho o arquivo docs/SCHEMA.sql pronto.

1. Crie um README curto em docs/SETUP_SUPABASE.md com passo a passo:
   - Como criar projeto no Supabase
   - Como executar o schema (SQL Editor → colar arquivo)
   - Como criar os 3 buckets de storage (box-photos, item-photos, invoice-xmls)
     com configurações privadas
   - Como configurar as policies de storage
   - Como criar o primeiro manager manualmente
   - Como configurar variáveis de ambiente

2. Adicione a este README os comandos SQL exatos para policies de storage.

3. Adicione validação no boot do app que verifica se as env vars existem
   e dá erro claro se faltar alguma.
```

---

## FASE 2 — Recebimento (Operador)

### Prompt 2.1 — Captura via Webcam

```
Implemente captura de fotos via webcam para o fluxo do operador.

REQUISITOS:
1. Componente reutilizável WebcamCapture em /components/shared/.
2. Use react-webcam ou getUserMedia nativo.
3. Compressão client-side antes do upload usando browser-image-compression
   (target: 500KB, JPEG, qualidade 0.85, max width 1600px).
4. Pré-visualização das fotos capturadas em grid.
5. Botão para descartar foto e refazer.
6. Tratamento de erros: webcam não detectada, permissão negada.
7. Componente recebe props:
   - minPhotos, maxPhotos
   - onPhotosChange (callback com array de Files comprimidos)
   - label (ex: "Fotos da Caixa")
8. Indicador "X de Y fotos" abaixo da preview.

Use TypeScript estrito. Documente com JSDoc.
```

### Prompt 2.2 — Listener de Leitor EAN

```
Implemente um hook React useBarcodeScanner para capturar input do leitor
de código de barras USB-HID.

CONTEXTO:
- Leitor USB-HID se comporta como teclado: digita rápido todos os
  caracteres e envia Enter ao final.
- Diferenciação chave: humano digita devagar (~150ms entre teclas);
  leitor digita em rajada (<30ms entre teclas).

REQUISITOS:
1. Hook useBarcodeScanner({ onScan, minLength, expectedLength, timeoutMs }).
2. Captura keydown global ou em ref de input.
3. Distingue scanner (input rápido) de digitação humana com base em
   intervalo entre teclas.
4. Ao detectar Enter, chama onScan com a string capturada.
5. Valida comprimento: chamadas com length < minLength são ignoradas.
6. Hook funciona tanto em foco em input quanto sem foco (modo global).
7. Retorna { isListening, lastScan, reset }.

Crie testes simulando eventos de teclado em ambos modos.
```

### Prompt 2.3 — Integração Webmania

```
Implemente integração com a API Webmania para consulta de NF.

REQUISITOS:
1. Crie /lib/integrations/webmania.ts com função consultarNF(accessKey).
2. Use a env var WEBMANIA_API_TOKEN.
3. Cache: antes de consultar, verifica tabela invoice_cache. Se existe,
   retorna do cache. Se não, consulta API e salva no cache.
4. Retry com backoff exponencial: 3 tentativas (1s, 2s, 4s).
5. Timeout de 10s por request.
6. Em caso de falha definitiva, retorna {success: false, error}.
7. Salva XML retornado em Supabase Storage (bucket invoice-xmls,
   path: {accessKey}.xml).
8. Atualiza/insere registro em invoice_cache com URL do XML.
9. Server Action consultarNFAction(accessKey) que chama essa função.

Tipos TypeScript completos para resposta da Webmania.
Documentar API reference em /docs/INTEGRATIONS.md.
```

### Prompt 2.4 — Fluxo Completo de Recebimento

```
Implemente o fluxo completo de /operador/recebimento conforme RF3 do PRD.

ESTRUTURA:
- Use uma máquina de estados (XState ou reducer pattern).
- Cada etapa é um componente filho.
- Estado global do recebimento mantido no parent.
- URL não muda entre etapas (single page com transições).

ETAPAS conforme PRD seção 3 RF3:
1. Captura de Identificador (chave/postal/ilegível com fallbacks)
2. RV
3. Número de itens
4. Fotos da caixa
5. Fotos dos itens
6. Revisão
7. Conclusão (Server Action que cria o Return)

INTEGRAÇÕES:
- Etapa 1 com chave válida: chama Webmania, mostra loading, exibe dados da
  NF. Se falhar Webmania mas chave válida, prossegue (consulta em background).
- Fotos: upload para Supabase Storage com path
  /returns/{returnId}/box/{photoId}.jpg ou /items/.
- Conclusão: Server Action cria registros nas tabelas returns e return_photos
  em transação.

UX:
- Componente de progresso "Etapa X de 7" no topo.
- Botão Voltar em cada etapa preserva estado.
- Botão Cancelar com confirmação.
- Beep + flash verde no sucesso (use Web Audio API e classe CSS animada).
- Beep duplo + flash vermelho no erro.
- Foco automático no input ativo de cada etapa.
- Após concluir: tela de sucesso 2s, então redireciona para fresh
  /operador/recebimento.

Crie testes unitários para a Server Action de criação do return,
incluindo casos de erro.
```

---

## FASE 3 — Decisão do Cliente

### Prompt 3.1 — Tabela de Devoluções Pendentes

```
Implemente /cliente conforme RF4 do PRD.

REQUISITOS:
1. Server Component que busca devoluções com status='awaiting_decision'
   dos depositantes vinculados ao cliente logado.
2. Tabela com TODAS as colunas listadas em RF4.2.
3. Paginação server-side (50 por página, use cursor pagination).
4. Filtros (Client Component que atualiza search params):
   - Depositante (dropdown se cliente tem >1)
   - Range de data
   - Toggle pendentes/histórico
5. Hover/tap em thumbnails abre galeria em Popover (shadcn Popover).
6. Coluna "Tempo Restante": componente client-side que calcula 72h -
   (now - received_at), atualiza a cada minuto. Cores: vermelho < 24h,
   amarelo < 48h, normal acima.
7. Botão "Baixar XML" gera URL assinada do Supabase Storage (válida 5min).
8. Banner discreto no topo: "ℹ️ Devoluções sem decisão em 72h são
   automaticamente armazenadas para tratativas."

PERFORMANCE:
- Use Suspense com skeleton para carregamento.
- Imagens com next/image otimizadas.
- Apenas thumbnails carregadas inicialmente; full size sob demanda.
```

### Prompt 3.2 — Modal de Confirmação Dupla

```
Implemente o modal de confirmação para tomada de decisão (RF4.4).

REQUISITOS:
1. Componente DecisionConfirmModal em /components/shared/.
2. Props: isOpen, onClose, decision (enum), returnData (objeto), onConfirm.
3. Layout:
   - Header com cor da decisão (full-bleed) e nome em destaque
   - Aviso: "ESTA DECISÃO É IRREVERSÍVEL" em vermelho
   - Resumo da devolução: RV, identificador, miniaturas das fotos
   - Para 'return_to_stock', 'discard', 'repackage': dropzone obrigatório
     para upload XML
   - Para 'store_for_handling': sem upload
   - Botão "Confirmar" desabilitado por 2 segundos após abertura
     (mostra contador 2... 1... ativa)
   - Botão "Cancelar"
4. Validações:
   - XML obrigatório quando aplicável
   - Validar tipo MIME application/xml ou text/xml
   - Tamanho máximo 5MB
5. Ao confirmar, chama Server Action submitDecision que:
   - Faz upload do XML para Supabase Storage (se aplicável)
   - Atualiza Return (status='decided', decision, decided_at, decided_by,
     decided_by_type='client', return_invoice_xml_url)
   - Tudo em transação. Se falhar, rollback.
6. Loading state durante submissão.
7. Feedback de sucesso/erro com toast.
8. Fechamento do modal e refresh da tabela após sucesso.
```

### Prompt 3.3 — Histórico do Cliente

```
Implemente /cliente/historico mostrando devoluções com status 'decided'
ou 'processed'.

DIFERENÇAS DA TABELA DE PENDENTES:
- Sem botões de decisão (read-only).
- Coluna "Decisão" mostra a escolhida (com cor).
- Coluna "Decidido por": "Você" se decided_by_type='client', "Automático
  (72h)" se 'auto'.
- Coluna "Data Decisão" no lugar de "Tempo Restante".
- Sem coluna de status de processamento (cliente NÃO vê processed_at).
- Botão "Baixar NF Devolução" se aplicável.

Ordenação padrão: data decisão decrescente.
```

---

## FASE 4 — Tratativa do Operador

### Prompt 4.1

```
Implemente /operador/tratativas conforme RF5 do PRD.

REQUISITOS:
1. Server Component que busca devoluções com status='decided'.
2. Indicador no topo: "X tratativas pendentes".
3. Campo de busca por RV no topo, com auto-foco (operador bipa o RV
   da caixa que pegou). Ao bipar e pressionar Enter:
   - Filtra a tabela mostrando apenas o RV bipado
   - Se for único, abre o modal de detalhes automaticamente
4. Tabela com:
   - RV
   - Decisão (cor + ícone)
   - Indicador "Auto" se decision_source='auto' (ícone diferenciado)
   - Data decisão
   - Cliente / Depositante
   - Botão "Ver detalhes"
   - Botão "Concluir"
5. Modal de detalhes: mostra fotos, link XML NF original, link XML NF
   devolução (se houver), RV, todas datas.
6. Modal de conclusão: simples, 1 etapa. "Confirma conclusão da tratativa
   do RV X?" com Confirmar/Cancelar.
7. Server Action concluirTratativa(returnId): atualiza status='processed',
   processed_at, processed_by.
8. Após conclusão: linha some, contador atualiza.
9. Lista carrega no page load (sem realtime).
```

---

## FASE 5 — Administração

### Prompt 5.1 — CRUD Usuários

```
Implemente /admin/usuarios conforme RF6.1.

PÁGINAS:
- /admin/usuarios (lista)
- /admin/usuarios/novo (criar)
- /admin/usuarios/[id] (editar)

LISTA:
- Tabela com: nome, email, role (badge colorido), telefone, ativo, ações
- Filtros: por role, por status (ativo/inativo)
- Busca por nome ou email
- Botão "Novo Usuário" no topo

CRIAR USUÁRIO:
- Form com: nome*, email*, telefone, role* (select)
- Se role='client': seleção múltipla de depositantes (com busca)
- Botão "Cadastrar novo depositante" abre modal inline com CNPJ + razão social
- Validação de email único
- Validação de CNPJ (algoritmo dos dígitos verificadores)
- Server Action que:
  1. Cria usuário em auth.users via Supabase Admin API (com magic link
     auto-disparado)
  2. Cria profile com role
  3. Se cliente: cria registros em client_depositors
- Tratamento de erro: email já existe, CNPJ inválido, etc.

EDITAR USUÁRIO:
- Mesmos campos, exceto email e role (read-only — exigem recriar)
- Para clientes: gerenciar depositantes vinculados
- Botão "Reenviar magic link"
- Botão "Desativar" (soft delete) com confirmação

UX:
- Use shadcn Form (react-hook-form + zod)
- Loading states em submissões
- Toast para feedback
```

### Prompt 5.2 — CRUD Depositantes

```
Implemente /admin/depositantes conforme RF6.2.

PÁGINA ÚNICA com tabela e modais para criar/editar.

TABELA:
- CNPJ (formatado XX.XXX.XXX/XXXX-XX)
- Razão Social
- Clientes Vinculados (badge com contagem; clique abre lista)
- Total Devoluções (último 30 dias)
- Ativo (toggle)
- Ações: Editar, Ver Vínculos

CRIAR/EDITAR:
- Modal com CNPJ e razão social
- Validação de CNPJ
- CNPJ único

VER VÍNCULOS:
- Modal mostrando todos clientes vinculados com link para perfil
```

### Prompt 5.3 — Dashboard

```
Implemente /admin (dashboard) conforme RF6.3.

LAYOUT:
- Filtro de período no topo (Hoje / 7d / 30d / Custom)
- Grid 4 colunas de cards de métricas
- Grid 2 colunas de gráficos (Recharts)
- Tabela "Top 10 Clientes"
- Lista de "Devoluções pendentes >48h"

QUERIES:
- Crie /lib/queries/dashboard.ts com funções tipadas para cada métrica.
- Use SQL agregado eficiente (não traga linhas individuais para o front).
- Use views materializadas se necessário para performance (mas primeiro
  meça com EXPLAIN).

CARDS:
1. Total devoluções (período) — número grande + variação % vs período anterior
2. Pendentes de decisão — número + alerta vermelho se houver >48h
3. Tempo médio de decisão — em horas, formato "12h 34min"
4. Taxa de auto-decisões — % com barra de progresso

GRÁFICOS:
- Pizza: status (3 fatias)
- Barras horizontais: distribuição de decisões (4 barras coloridas)

TOP 10 CLIENTES:
- Tabela: cliente, depositantes, total, % auto-decisões

ALERTAS:
- Cards horizontais clicáveis levam para /admin/devolucoes/[id]
```

---

## FASE 6 — Jobs e E-mails

### Prompt 6.1 — Edge Functions

```
Implemente as 3 Edge Functions no Supabase.

1. auto-decision-job (a cada 1h via pg_cron):
   - Já implementado em SQL puro como job_auto_decision().
   - Crie wrapper em /supabase/functions/auto-decision/index.ts apenas
     se precisar de lógica adicional. Senão, deixe puramente em SQL.

2. warning-email-job (a cada 1h):
   - Em /supabase/functions/warning-email/index.ts.
   - Lê view returns_needing_warning.
   - Para cada cliente único, agrupa devoluções e envia 1 email com a lista.
   - Usa Resend (SDK).
   - Após envio, marca warning_sent_at = now() em todas as returns enviadas.
   - Tratamento de erro: log via console, mas não falha o batch inteiro
     se 1 email falhar.
   - Schedule via cron extension Supabase.

3. photo-cleanup-job (1x ao dia):
   - Em /supabase/functions/photo-cleanup/index.ts.
   - Chama job_photo_cleanup_marker() para listar fotos a remover.
   - Remove arquivos do Storage.
   - Remove registros de return_photos.
   - Logs detalhados.

Documente em /docs/JOBS.md como deployar e monitorar essas functions.
```

### Prompt 6.2 — Templates de E-mail

```
Crie templates de e-mail React Email para os 2 e-mails customizados:

1. /emails/AccountCreated.tsx
   - Boas-vindas
   - Logo Logvale
   - Texto: "Sua conta foi criada. Clique no botão abaixo para acessar."
   - Botão CTA "Acessar Logvale" (com magic link gerado)
   - Footer com contato e link política

2. /emails/PendingDecisionWarning.tsx
   - Logo Logvale
   - "Você tem X devoluções aguardando decisão"
   - Aviso: "Em menos de 24h, sem decisão, serão armazenadas para tratativas
     automaticamente"
   - Lista das devoluções: RV, data, link
   - Botão CTA "Ver Devoluções" → /cliente
   - Footer

ESTILO:
- Cores Logvale (#08366D, #F12D46)
- Fonte Roboto (com fallback para Arial em e-mail)
- Mobile-friendly
- Texto simples + HTML

Configure Resend em /lib/integrations/resend.ts com helpers tipados:
- sendAccountCreatedEmail({to, magicLink})
- sendPendingWarningEmail({to, returns})

Render templates com @react-email/render.
```

---

## FASE 7 — LGPD

### Prompt 7.1

```
Implemente recursos de LGPD conforme RF8.

1. Páginas estáticas /privacidade e /termos:
   - Acesse /docs/LGPD.md (vou fornecer texto base).
   - Renderize com tipografia legível e índice navegável.
   - Acessível em links no footer e antes de aceitar termos.

2. Aceite de termos no primeiro login:
   - Após magic link, se profile.terms_accepted_at IS NULL, redireciona
     para /aceite-termos.
   - Página com checkbox "Li e aceito" e botão "Aceitar".
   - Action atualiza terms_accepted_at = now().
   - Sem aceitar, não consegue prosseguir.

3. Em /admin/usuarios/[id], adicione 2 botões:
   - "Exportar dados pessoais" → gera ZIP com JSON de:
     - Profile completo
     - Returns relacionados (read-only summary)
     - Logs de aceite
   - "Anonimizar usuário" (com modal de confirmação dupla):
     - Substitui full_name por "[ANONIMIZADO]"
     - Substitui phone por null
     - Substitui email no auth.users por anon-{uuid}@logvale.local
     - Define active=false
     - PRESERVA: associações fiscais, returns (dados financeiros são
       obrigatórios por 5 anos)

4. Documente o procedimento de retenção em /docs/LGPD.md.
```

---

## FASE 8 — Hardening

### Prompt 8.1 — Testes

```
Adicione testes ao projeto.

CONFIGURAR:
- Vitest para unit/integration
- Playwright para E2E

UNIT TESTS (cobertura mínima 70% nas pastas críticas):
- /lib/integrations/webmania.ts (mock fetch)
- /lib/queries/* (com Supabase test client)
- Hooks: useBarcodeScanner
- Server Actions: submitDecision, completeHandling, createReturn

E2E TESTS (cenários críticos):
1. Operador completa recebimento end-to-end
2. Cliente toma decisão (cada uma das 4)
3. Operador completa tratativa
4. Manager cria usuário cliente e vincula depositante

CI:
- GitHub Actions: rodar lint, type-check, vitest em PR
```

### Prompt 8.2 — Performance e Acessibilidade

```
Audite o projeto e aplique correções:

1. Lighthouse em todas rotas principais. Alvo: >90 em todas categorias.
2. WCAG 2.1 AA: navegação por teclado em fluxos críticos, contraste
   verificado, alt em imagens, labels em inputs.
3. Bundle size: analise com @next/bundle-analyzer. Code-split rotas pesadas.
4. Imagens: next/image com sizes corretos.
5. Database: rode EXPLAIN ANALYZE em queries lentas. Adicione índices
   ausentes.
6. Implemente skeletons em todos lugares com Suspense.

Liste o que foi alterado e métricas antes/depois.
```

### Prompt 8.3 — Tratamento de Erros e Edge Cases

```
Revise edge cases:

1. Webmania offline durante recebimento — operador deve conseguir
   prosseguir.
2. Cliente com múltiplos CNPJs — UI lida corretamente?
3. Auto-decisão acontece enquanto cliente está com modal aberto — o que
   acontece ao confirmar?
4. Operador inicia recebimento, perde conexão na etapa 5 — dados perdidos
   ou recuperados?
5. Upload de XML de devolução com arquivo corrompido — feedback?
6. Sessão expirada durante operação — flow de re-auth?
7. Manager desativa cliente que tem devoluções pendentes — o que acontece?
8. Foto com conteúdo inadequado — validação? (provavelmente fora de escopo
   v1)

Implemente tratamento adequado em cada caso, com UX clara.
Adicione Error Boundary em cada layout de role.
Configure Sentry para monitoramento de erros em produção.
```

---

## Dicas Finais

**Como manter qualidade ao longo das fases:**

1. **No início de cada nova sessão de Claude Code:** sempre execute `/init`
   ou cole novamente o conteúdo do CLAUDE.md.

2. **Antes de cada prompt grande:** verifique se a Claude Code leu os arquivos
   atualizados. Se não, peça explicitamente.

3. **Após cada fase:** faça commit, rode testes, valide visualmente.

4. **Quando der erro complexo:** abra Claude Pro (chat web) com o erro,
   stack trace e contexto, peça análise. Volte para Claude Code com a
   solução proposta.

5. **Não pule fases:** a tentação de implementar dashboard antes do CRUD
   parece pequena, mas gera retrabalho.

6. **Code review por IA:** ao final de cada fase, peça à Claude Code para
   revisar o código produzido na fase. Ela acha bugs e más práticas com
   frequência.
