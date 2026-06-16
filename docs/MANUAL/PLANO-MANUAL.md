# Plano de Produção — Manual do Usuário Logvale

> **Status:** Aprovado para execução · **Versão do plano:** 1.1 (revisado com o código atual) · **Data:** 2026-06-15
> Este é o **plano**, não o manual. A construção do manual começa após validação deste documento.
>
> **v1.1 — o que mudou:** revisão completa contra o código. Correções relevantes: login é **e-mail + senha** (não magic link); primeiro acesso cria senha + aceita termos numa só tela; convite/acesso é **link copiado e enviado manualmente pelo gerente**; a Etapa 1 do recebimento tem **seletor de depositante**; a marca é **ícone Reversa + logotipo Logvale**. Detalhes na seção 9.

---

## 1. Objetivo

Produzir um **manual do usuário completo, imprimível e com a identidade visual da Logvale**, que cubra todo o sistema de gestão de devoluções para os três perfis de usuário, escrito em linguagem acessível a pessoas com **baixo conhecimento técnico**.

### Princípios norteadores
1. **Realidade acima da documentação.** O manual descreve o que o app **faz hoje**, validado no código — não o que o PRD planejou. (Ex.: login por senha; cliente vê 3 decisões.)
2. **Três camadas de profundidade.** Entender rápido → navegar em detalhe → consultar referência.
3. **Um perfil por vez.** Cada usuário só enxerga o próprio mundo; o manual respeita esse isolamento.
4. **Linguagem simples.** Frases curtas, sem jargão; todo termo técnico tem entrada no glossário.
5. **Pronto para imprimir.** Sai limpo em PDF (quebras de página por capítulo, legível em P&B).

---

## 2. Decisões já tomadas (parâmetros fixos)

| Item | Decisão |
|---|---|
| **Formato** | HTML auto-contido imprimível (print-to-PDF) |
| **Idioma do manual** | PT-BR |
| **Escopo da 1ª versão** | Os três perfis: Operador, Cliente, Gerente |
| **Screenshots** | Placeholders marcados `[SCREENSHOT: ...]` para inserir depois |
| **Logo** | `public/logvale-logo.png` (no lockup com o ícone Reversa) |
| **Contato de suporte** | cadu@logvale.com.br · +55 (12) 99713-8919 (WhatsApp e telefone) |

---

## 3. Identidade visual

| Elemento | Valor | Fonte (verificada) |
|---|---|---|
| Lockup da marca | **Ícone Reversa** + logotipo `logvale-logo.png` + subtítulo "Gestão de Devoluções" | `components/shared/logvale-logo.tsx` |
| Logo (arquivo) | `public/logvale-logo.png` | confirmado |
| Azul primário | `#08366D` — cabeçalhos, faixas, links | PRD §1.4 |
| Vermelho (acento/alerta) | `#F12D46` | PRD §1.4 |
| Verde decisão "Estoque" | verde-600 (`#10B981`) | `lib/decisions.ts` |
| Laranja decisão "Tratativa" | âmbar-500 (`#F59E0B`) | `lib/decisions.ts` |
| Vermelho decisão "Descarte" | vermelho-600 (`#F12D46`) | `lib/decisions.ts` |
| Fonte | Roboto (Google Fonts), pesos 400/500/700 | PRD §1.4 |

> O cabeçalho do manual deve **reproduzir o lockup real** (ícone Reversa + logotipo Logvale + "Gestão de Devoluções"), como aparece nas telas de login e primeiro acesso.

---

## 4. Arquitetura do entregável

```
docs/MANUAL/
├── PLANO-MANUAL.md            ← este documento
├── manual-logvale.html        ← entregável principal (auto-contido)
├── assets/
│   ├── logvale-logo.png       ← cópia do logo (portabilidade)
│   └── screenshots/           ← PNGs inseridos depois (placeholders por enquanto)
└── README.md                  ← como abrir, imprimir e atualizar o manual
```

O HTML embute todo o CSS inline e referencia o logo + screenshots por caminho relativo, de modo que a pasta `docs/MANUAL/` seja portável (pode ser zipada e enviada).

---

## 5. Sumário completo do manual

### Parte 0 — Boas-vindas (comum a todos)
- **0.1** O que é o Sistema Logvale de Devoluções (visão de 3 frases + diagrama do ciclo de vida)
- **0.2** Quem usa o sistema (os 3 perfis em uma tabela simples)
- **0.3** Glossário em linguagem simples: Devolução, RV, Chave de Acesso, NF/XML, Depositante, Tratativa, Auto-decisão, Reembalagem
- **0.4** Como acessar o sistema *(comum)*:
  - **Entrar** (`/login`, "Acesso ao Sistema"): e-mail + **senha**, botão "Entrar"
  - **Primeiro acesso** (`/primeiro-acesso`, "Bem-vindo ao Logvale"): receber o **link de acesso do gerente**, criar senha (mín. 8 caracteres), confirmar senha e **aceitar os Termos de Uso e a Política de Privacidade** (checkbox) → "Criar senha e acessar"
  - "Esqueci a senha / link expirou" → solicitar novo link ao administrador (não há auto-recuperação)

### Parte 1 — Guia Rápido (1 página por perfil) — camada "entender rápido"
- **1.1** Operador em 1 página (caminho feliz ilustrado)
- **1.2** Cliente em 1 página
- **1.3** Gerente em 1 página

### Parte 2 — Manual do Operador (detalhado)
- **2.1** Requisitos: desktop, webcam USB, leitor de código de barras (EAN/USB-HID)
- **2.2** Tela inicial: saudação, mini-indicadores (Hoje · Esta semana · Tratativas pendentes), cards de navegação (Novo Recebimento · Tratativas), tabela "Tratativas Pendentes"
- **2.3** Novo Recebimento — fluxo de 7 etapas, cada uma com objetivo, ações e o que acontece depois:
  1. **Etapa 1 — Identificação da NF:** bipar Chave de Acesso (44 díg.) → consulta Webmania. Cadeia de fallback: "Não consigo bipar — digitar à mão" → "NF ilegível — usar Código Postal" (bipar/digitar CEP, 8 díg.) → "CEP também ilegível — marcar como ilegível" (gera token). **Sub-etapa: seletor de depositante** — confirmar o depositante sugerido pela NF ou trocar manualmente; é possível "Avançar sem Depositante"
  2. **Etapa 2 — RV:** bipar o EAN do RV colado na caixa; fallback "digitar à mão"
  3. **Etapa 3 — Nº de Itens:** inteiro positivo
  4. **Etapa 4 — Fotos da Caixa:** 2 a 4 fotos via webcam (tecla Enter dispara a captura); pré-visualização e remoção
  5. **Etapa 5 — Fotos dos Itens:** 1 a 5 fotos (mesmas regras)
  6. **Etapa 6 — Revisão:** conferir cada bloco (botão "Editar" por seção), baixar XML da NF; "Confirmar e Registrar"
  7. **Etapa 7 — Registrar Recebimento:** envia as fotos → registra a devolução → tela de sucesso → volta ao início
  - **Auxiliares:** barra de progresso "Etapa X de 7"; botão **"Cancelar"** abre diálogo "Cancelar recebimento? Todos os dados serão descartados" (Continuar / Descartar); beep + flash verde no sucesso e vermelho no erro; auto-foco no campo ativo
- **2.4** Tratativas (`/operador/tratativas`): busca por RV com **auto-foco** (basta bipar a RV da caixa); colunas RV, Decisão (com etiqueta "Auto"), Data Decisão, Depositante, Cliente; "Ver detalhes" abre modal com fotos/NF/RV e botão **Concluir**; contador "X pendentes"
- **2.5** Erros comuns do operador (scanner não bipou, NF não encontrada na Webmania, foto ruim)

### Parte 3 — Manual do Cliente (detalhado)
- **3.1** Tela "Devoluções Pendentes": aviso das 72h, filtros (depositante quando houver mais de um, data De/Até), contador de devoluções
- **3.2** Lendo a tabela: Data, Identificador (Chave NF / CEP / Ilegível), NF (XML), RV, Itens, Fotos da Caixa, Fotos dos Itens, Decisão, Tempo Restante
- **3.3** Galeria de fotos (abrir, navegar)
- **3.4** **As 3 decisões** (linguagem do cliente, conforme `lib/decisions.ts`):
  - 🟢 **Estoque** — produto saudável, volta ao estoque para venda *(exige XML da NF de devolução)*
  - 🟠 **Tratativa** — vai para área segregada no galpão; procurar o comercial Logvale *(não exige XML)*
  - 🔴 **Descarte** — produto será descartado; termos negociados com o comercial Logvale *(exige XML)*
  - Nota: **"Reembalagem" não é uma opção escolhível pelo cliente** (existe no histórico/sistema, mas não nos botões)
- **3.5** Confirmação em duas etapas: 1º clique abre modal (decisão em destaque com descrição, aviso "Esta decisão é irreversível", resumo da devolução, upload de XML quando exigido, botão "Confirmar" travado por 2s); 2º clique confirma
- **3.6** Regra das 72h (auto-decisão → Tratativa) e aviso por e-mail após 48h
- **3.7** Histórico (`/cliente/historico`): decisões passadas, etiqueta "Auto" quando o sistema decidiu
- **3.8** Perfil (`/cliente/perfil`): dados pessoais e depositantes vinculados (somente leitura) + botão "Sair"
- **3.9** Dúvidas do cliente (perdi o prazo, qual XML enviar, posso desfazer — não)

### Parte 4 — Manual do Gerente (detalhado)
- **4.1** Dashboard (`/admin`): cards (Total 30 dias · Pendentes · Tempo médio até decisão · Taxa de auto-decisão), gráficos (por status, por decisão), Top clientes, Pendentes urgentes
- **4.2** Usuários (`/admin/usuarios`): filtros por perfil; **Criar** (nome, e-mail [só na criação], telefone, perfil; se Cliente → marcar depositantes vinculados, com "+ Novo depositante" inline); **Editar** (não altera e-mail); **Ativar/Desativar**; **Reenviar link** (gera o link de acesso → modal "Copie e envie ao usuário" com botão Copiar — **envio é manual**); **Exportar dados** (baixa ZIP); **Anonimizar** (irreversível, confirmação com 2s, mantém dados fiscais)
- **4.3** Depositantes (`/admin/depositantes`): criar/editar (CNPJ, razão social), ver clientes vinculados
- **4.4** Onboarding de cliente (white glove) — passo a passo: criar usuário → vincular depositantes → "Reenviar link" → copiar e enviar o link → cliente faz o primeiro acesso
- **4.5** Visão geral de devoluções (`/admin/devolucoes`): busca por RV e filtro por status (aguardando decisão / decidido / processado)
- **4.6** Ferramentas LGPD: exportar dados de um usuário, anonimizar

### Parte 5 — Referência e Solução de Problemas (comum)
- **5.1** Tabela-resumo das decisões (cor · significado · exige XML? · reversível?)
- **5.2** Ciclo de vida de uma devolução (diagrama: aguardando decisão → decidido → processado)
- **5.3** Prazos do sistema (aviso 48h, auto-decisão 72h)
- **5.4** Perguntas frequentes (FAQ) por perfil — incluir "esqueci a senha" → contatar gerente
- **5.5** Glossário completo
- **5.6** Suporte: cadu@logvale.com.br · +55 (12) 99713-8919 (WhatsApp e telefone)
- **5.7** Seus direitos (LGPD): acesso, exportação, anonimização; onde ficam Política (`/privacidade`) e Termos (`/termos`)

---

## 6. Convenções de conteúdo

- **Tom:** segunda pessoa ("você"), direto, instrucional. Verbos no imperativo nos passos ("Bipe a NF", "Clique em Confirmar").
- **Passos numerados** nas seções detalhadas; cada passo diz **o que fazer** e **o que acontece**.
- **Caixas de destaque (callouts):**
  - 💡 **Dica** — atalhos e boas práticas
  - ⚠️ **Atenção** — ações irreversíveis, prazos
  - ℹ️ **Nota** — comportamento do sistema
- **Placeholders de imagem:** bloco cinza com moldura e legenda `[SCREENSHOT: descrição]`, numerados para facilitar a substituição.
- **Referências de cor** sempre com nome + bolinha colorida (acessibilidade; não depender só da cor).
- **Terminologia da interface:** usar os rótulos reais do app (ex.: "Reenviar link", "Avançar sem Depositante", "Confirmar e Registrar", "Criar senha e acessar"). O campo de perfil aparece como "Role" na tela de usuários — explicar como "Perfil (Role)".

---

## 7. Inventário de telas (checklist de screenshots)

Lista das capturas a produzir depois; o texto já fica pronto com placeholders correspondentes.

**Comum:** login (e-mail + senha) · primeiro acesso (criar senha + aceite) · e-mail/mensagem com o link de acesso.
**Operador:** home · etapa 1 (leitor aguardando) · etapa 1 (seletor de depositante) · etapa 1 (estado "NF Ilegível") · etapa 2 RV · etapa 3 nº itens · etapa 4 fotos caixa (webcam) · etapa 5 fotos itens · etapa 6 revisão · etapa 7 sucesso · diálogo "Cancelar recebimento" · lista de tratativas · modal de detalhes/concluir.
**Cliente:** devoluções pendentes (tabela cheia) · galeria de fotos · modal de confirmação (com e sem campo de XML) · histórico (com etiqueta Auto) · perfil.
**Gerente:** dashboard (cards + gráficos) · lista de usuários · formulário de novo usuário (com depositantes) · modal "Copie e envie ao usuário" · lista de depositantes · visão geral de devoluções · diálogo de anonimização.

> Total estimado: ~30 capturas. Recomenda-se ambiente com dados de exemplo (seed) e os três perfis logáveis.

---

## 8. Rastreabilidade — de onde vem cada conteúdo

| Seção | Fonte primária (verificada no código) |
|---|---|
| Login (e-mail + senha) | `app/(public)/login/login-form.tsx`, `lib/i18n/pt-BR.ts` (`auth.login`) |
| Primeiro acesso (senha + termos) | `app/(public)/primeiro-acesso/page.tsx` + `set-password-form.tsx`, i18n `auth.firstAccess`/`auth.terms` |
| Aceite de termos | `app/(public)/aceite-termos/page.tsx` (redireciona p/ primeiro acesso) |
| Marca / lockup | `components/shared/logvale-logo.tsx` |
| Recebimento (7 etapas + depositor picker + cancelar) | `app/(operator)/operador/recebimento/receiving-flow.tsx` e `steps/*` |
| Home do operador | `app/(operator)/operador/page.tsx` |
| Tratativas (busca por RV, concluir) | `app/(operator)/operador/tratativas/components/tratativas-list.tsx` |
| Decisões (3 botões, cores, XML) | `lib/decisions.ts`, `cliente/components/returns-table.tsx`, `decision-modal.tsx` |
| Tela e histórico do cliente | `app/(client)/cliente/page.tsx`, `perfil/page.tsx` |
| Usuários / onboarding / LGPD | `app/(manager)/admin/usuarios/components/users-table.tsx` |
| Dashboard / devoluções (gerente) | `app/(manager)/admin/page.tsx`, `devolucoes/page.tsx` |
| Prazos 48h/72h | PRD §RF4.6/RF4.7 + aviso na tabela do cliente |
| LGPD | `docs/LGPD.md` + PRD §RF8 |

**Regra:** nenhuma afirmação no manual sem fonte verificada. Onde o PRD diverge do código, **vence o código** e a divergência é registrada na seção 9.

---

## 9. Divergências PRD × código (verificadas)

| Tema | PRD diz | App faz hoje | Tratamento no manual |
|---|---|---|---|
| **Autenticação** | Login por **magic link** | **E-mail + senha** (`signInWithPassword`) | Documentar login por senha |
| **Primeiro acesso** | Magic link + aceite de termos separado | Tela única: criar senha (mín. 8) + confirmar + aceitar termos | Documentar tela única "Bem-vindo ao Logvale" |
| **Disparo do convite** | "Magic link disparado automaticamente" | Gerente clica "Reenviar link", **copia e envia manualmente** | Documentar fluxo manual |
| **Decisões do cliente** | 4 botões (inclui Reembalagem/azul) | **3 botões**: Estoque, Tratativa, Descarte | Documentar 3; nota sobre Reembalagem indisponível |
| **XML obrigatório** | "verde/azul/vermelho" | obrigatório em **Estoque e Descarte**; não em Tratativa | Documentar regra real |
| **Etapa 1 do recebimento** | Só identificador + fallbacks | Inclui **seletor de depositante** (confirma/troca; pode avançar sem) | Documentar a sub-etapa |
| **Marca** | "Logo Logvale" | Lockup **ícone Reversa + logotipo Logvale** + "Gestão de Devoluções" | Reproduzir o lockup real |

---

## 10. Build técnico do HTML

- **Estrutura:** `<head>` com `<style>` inline + import do Roboto; `<body>` com cabeçalho (lockup da marca + título), sumário com âncoras clicáveis, capítulos com `id`.
- **CSS de tela:** layout legível (largura máx. ~820px), cores da marca em faixas de capítulo, componentes para callouts e placeholders.
- **CSS de impressão (`@media print`):** `page-break-before` por Parte, esconder navegação flutuante, garantir contraste em P&B, rodapé com contato.
- **Navegação:** índice no topo + botão "voltar ao topo"; tudo funciona offline (arquivo único).
- **Acessibilidade:** hierarquia de headings correta, `alt` nos placeholders, não depender só de cor.

---

## 11. Fluxo de produção (fases e entregáveis)

| Fase | Entregável | O que validar |
|---|---|---|
| **F0 — Esqueleto** | `manual-logvale.html` com cabeçalho, lockup da marca, CSS, sumário e Parte 0 + Parte 1 preenchidas | Estilo, tom e impressão (gerar 1 PDF de teste) |
| **F1 — Operador** | Parte 2 completa com placeholders | Precisão do fluxo de 7 etapas + depositor picker + cancelar |
| **F2 — Cliente** | Parte 3 completa | Decisões (3), confirmação dupla, prazos |
| **F3 — Gerente** | Parte 4 completa | CRUD, reenviar link, dashboard, LGPD |
| **F4 — Referência** | Parte 5 + glossário + FAQ | Consistência cruzada |
| **F5 — Capturas** | Substituição dos placeholders por screenshots reais | App com seed, 3 perfis |
| **F6 — QA final** | Revisão com checklist (seção 12) + README | Aprovação para distribuição |

> Recomendação: aprovar **F0** antes de seguir, para travar estilo e tom de uma vez.

---

## 12. Checklist de QA final

- [ ] Toda afirmação tem fonte verificada no código/PRD
- [ ] Login documentado como **e-mail + senha** (não magic link)
- [ ] Nenhuma menção a "4 decisões" para o cliente
- [ ] Cores sempre acompanhadas de rótulo textual
- [ ] Todos os `[SCREENSHOT: ...]` numerados e listados no inventário
- [ ] Glossário cobre todo termo técnico citado
- [ ] Contato de suporte correto em todas as ocorrências
- [ ] Imprime limpo em PDF (testado), com quebras por Parte
- [ ] Lockup da marca (Reversa + Logvale) carrega via caminho relativo
- [ ] Links do sumário funcionam (âncoras)
- [ ] Linguagem revisada para baixo conhecimento técnico

---

## 13. Manutenção

- Versionar junto ao código (já está em `docs/`).
- Cabeçalho do manual com **"Versão X · atualizado em DD/MM/AAAA"**.
- Quando uma tela mudar, atualizar (a) o texto, (b) o screenshot, (c) a data de versão.
- `README.md` da pasta explica como abrir, imprimir em PDF e trocar imagens.

---

## 14. Decisões pendentes / riscos

1. **Ambiente para screenshots (F5):** é preciso um ambiente com dados de exemplo e logins dos 3 perfis. Definir quem fornece/como gerar.
2. **Reembalagem:** confirmar se deve ser **omitida** do manual do cliente ou apenas explicada como "indisponível" (recomendação: explicar brevemente para evitar dúvida).
3. **Recuperação de senha:** não há auto-recuperação no app. Confirmar a orientação oficial ("contate o gerente para um novo link") antes de publicar no FAQ.
4. **Nome do produto:** a marca mostra "Reversa" (ícone) + "Logvale" (logotipo). Confirmar como nomear o sistema ao longo do manual (ex.: "Sistema Logvale" vs. "Reversa").
5. **Versão em PDF estática vs. HTML vivo:** entregamos o HTML; a geração do PDF é manual (imprimir → salvar como PDF). Se quiserem um PDF "oficial" anexado ao repo, definir o momento de congelar.
```
