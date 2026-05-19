# Próximos Passos — Fechamento V1

Status atual: sistema funcional, gaps identificados abaixo organizados por prioridade.

---

## Prioridade Alta — Bugs / Bloqueios

### 1. Download de XML não está funcionando
- **Contexto:** Botão de download do XML da NF de devolução na tabela do cliente (`/cliente`) e no histórico não executa o download corretamente.
- **Investigar:** A geração de signed URL em `lib/supabase/storage.ts` para o bucket `invoice-xmls`. Verificar se o caminho do arquivo no storage confere com o que foi gravado em `return_invoice_xml_path` no banco.
- **Arquivos relevantes:** `app/(client)/cliente/components/returns-table.tsx`, `lib/supabase/storage.ts`, `app/(client)/cliente/actions.ts`

---

## Prioridade Alta — UX / Correções

### 2. Substituir `window.confirm` na anonimização por modal próprio
- **Contexto:** `window.confirm()` em `app/(manager)/admin/usuarios/components/users-table.tsx:147` não funciona em iframes/Vercel previews e não segue o padrão visual do app.
- **Ação:** Criar um modal de confirmação simples (igual ao padrão já usado em cancelar recebimento e decisão do cliente) com botão "Anonimizar" bloqueado por 2 segundos — dado que é uma ação irreversível de LGPD.

### 3. Trocar `window.location.reload()` por `router.refresh()`
- **Contexto:** `app/(client)/cliente/components/decision-modal.tsx:73` usa reload completo quando detecta race condition com auto-decisão. Causa flash branco e quebra a UX.
- **Ação:** Substituir por `router.refresh()` do Next.js para soft-refresh sem reload de página.

### 4. Capturar foto com tecla Enter
- **Contexto:** No fluxo de recebimento do operador, etapas 4 e 5 (fotos da caixa / fotos dos itens), o operador precisa clicar no botão de captura. Para um ambiente desktop com leitor HID, poder usar Enter para disparar a captura acelera o fluxo.
- **Arquivo relevante:** `app/(operator)/operador/recebimento/steps/step-photos.tsx`
- **Ação:** Adicionar `useEffect` com listener de `keydown` para `Enter` que chama a função de captura, similar ao que já existe no `use-barcode-scanner.ts`. Desativar quando o modal de pré-visualização estiver aberto.

---

## Prioridade Média — Funcionalidades Faltando no PRD

### 5. Criar página `/cliente/perfil`
- **Contexto:** Listada no PRD (seção 6) mas não implementada. Está no nav do cliente.
- **Conteúdo mínimo:** Nome completo, e-mail, telefone, depositantes vinculados (read-only), botão de sign-out.
- **Arquivos relevantes:** `app/(client)/cliente/layout.tsx`, `app/(client)/cliente/components/client-nav.tsx`

### 6. Cadastro inline de depositante no formulário de criação de usuário (RF2.3)
- **Contexto:** O PRD exige que ao criar um usuário do tipo `client`, o gerente possa cadastrar um novo depositante inline (CNPJ + razão social) sem sair do formulário. Hoje é necessário ir em `/admin/depositantes`, criar, voltar e refazer o fluxo.
- **Arquivo relevante:** `app/(manager)/admin/usuarios/components/users-table.tsx` (seção de depositorIds)
- **Ação:** Adicionar campo "Novo depositante" expansível dentro do modal de criação de usuário, com inputs de CNPJ e razão social que, ao confirmar, chama `createDepositorAction` e já marca o novo registro.

### 7. Verificar métricas do dashboard (RF6.3)
- **Contexto:** O PRD exige dois tempos médios separados: "recebimento → decisão" e "decisão → processamento". O dashboard atual exibe apenas um (`avgDecisionHours`). Também falta filtro de período customizável (hoje / 7d / 30d / custom) além do fixo de 30 dias.
- **Arquivo relevante:** `app/(manager)/admin/actions.ts` (`getDashboardStatsAction`), `app/(manager)/admin/page.tsx`

---

## Prioridade Média — Novas Funcionalidades

### 8. Exportar histórico do cliente em XLSX
- **Contexto:** O cliente precisa exportar o histórico de devoluções (`/cliente/historico`) em formato Excel para conciliação interna.
- **Colunas sugeridas:** Data recebimento, RV, Tipo identificador, Identificador, Depositante, Nº itens, Decisão, Decidido por (cliente/auto), Data decisão, Status.
- **Abordagem:** Usar biblioteca `xlsx` (SheetJS) no lado servidor via Server Action, retornar o arquivo como buffer base64 e disparar download no cliente — mesmo padrão usado em `exportUserDataAction`.
- **Arquivos relevantes:** `app/(client)/cliente/historico/page.tsx`, `app/(client)/cliente/actions.ts`

---

## Prioridade Baixa — Polimento

### 9. Adicionar logo Logvale nas telas
- **Arquivo da logo:** `public/logo.png` — logotipo horizontal, fundo branco, texto "LOGVALE" com o "G" em vermelho (#F12D46) e o restante em azul (#08366D).
- **Contexto:** O arquivo existe mas não está exibido no header das áreas autenticadas, apenas na tela de login (verificar). O componente `components/shared/logvale-logo.tsx` existe — confirmar se está sendo usado nos layouts de cada role.
- **Arquivos relevantes:** `app/(operator)/operador/layout.tsx`, `app/(client)/cliente/layout.tsx`, `app/(manager)/admin/layout.tsx`, `components/shared/logvale-logo.tsx`
- **Para dark mode:** criar variante com fundo transparente ou escuro (logo atual tem fundo branco — verificar se precisa de versão SVG/PNG com fundo transparente).

### 10. Remover `formatDate` duplicada no dashboard do gerente
- **Contexto:** `app/(manager)/admin/page.tsx:11-17` define uma `formatDate` local que duplica `lib/format.ts`. Usar a importação da lib.

### 11. Melhorar frontend
- **Contexto:** Revisão visual completa para elevar a percepção de valor do produto ao nível de ferramentas SaaS premium (Linear, Vercel, Stripe, Framer).

**Identidade de marca a respeitar:**
- Logo: `public/logo.png` — horizontal, "G" em #F12D46, restante em #08366D.
- Azul `#08366D` = cor primária (CTAs, links, destaques). Vermelho `#F12D46` = acento (alertas, badges, ênfase pontual). Nunca usar as duas no máximo de intensidade ao mesmo tempo.
- Criar escala completa de cada cor (50→950) para estados, hovers e backgrounds sutis.
- Gradientes da marca com parcimônia: azul → vermelho ou azul → roxo (ponto intermediário).
- Base neutra: brancos, grays, ou tons escuros (dark mode) para que as cores da marca tenham impacto quando aparecerem.

**Prompt completo para execução:**
```
Atue como um designer sênior de produto e desenvolvedor frontend especializado em interfaces SaaS premium (no nível de Linear, Vercel, Stripe, Arc Browser e Framer). Sua missão é redesenhar completamente o frontend deste site para que ele transmita sofisticação, modernidade e valor percebido alto — um produto pelo qual usuários pagariam com prazer.

Identidade de marca a respeitar:
Cores oficiais: azul (#08366D) e vermelho (#F12D46) são as cores da marca e devem ser mantidas. Use-as como protagonistas, mas com inteligência: defina o azul como cor primária (CTAs principais, links, elementos de destaque) e o vermelho como cor de acento (alertas, badges, elementos de ênfase pontuais). Evite usar as duas com intensidade máxima ao mesmo tempo — isso polui a hierarquia.
Crie uma escala completa de cada cor (50 até 950, como o Tailwind faz) para ter flexibilidade em estados, hovers, backgrounds sutis e gradientes.
Use gradientes da marca com parcimônia em elementos marcantes (hero, CTAs especiais), combinando azul → vermelho ou azul → roxo (ponto intermediário entre as duas) para criar identidade visual única.
Neutros como base: apesar do azul e vermelho serem fortes, a maior parte do site deve ser neutra (brancos, grays, ou tons escuros no dark mode) para que as cores da marca tenham impacto quando aparecerem.

Logo da marca (arquivo: public/logo.png):
Adicione a logo da marca em locais estratégicos: navbar (canto superior esquerdo, tamanho discreto mas legível), footer, e favicon.
Garanta que a logo tenha versões adequadas para fundos claros e escuros (dark mode).
Mantenha área de respiro adequada ao redor (padding mínimo equivalente à altura de um caractere da logo).
No hover (quando clicável), aplique uma microanimação sutil — opacidade, leve scale, ou transição de cor.

Princípios de design obrigatórios:
Hierarquia visual refinada — escala tipográfica clara (Inter, Geist, ou similar), pesos 400/500/600/700. Títulos com tracking levemente negativo (-0.02em). Corpo com line-height 1.5–1.7.
Espaçamento generoso — escala consistente (4/8/12/16/24/32/48/64/96px). Respiração é luxo.
Componentes de UI polidos:
- Bordas sutis (1px com baixa opacidade)
- Sombras em camadas (combine 2-3 sombras suaves, não use box-shadow padrão)
- Cantos arredondados consistentes (8-12px cards, 6-8px botões)
- Gradientes sutis usando o azul da marca em backgrounds (mesh ou radial gradients)
- Glassmorphism com parcimônia em navbars/modals

Animações e microinterações:
- Framer Motion ou CSS transitions com cubic-bezier(0.16, 1, 0.3, 1)
- Fade-in + slide-up no scroll com stagger
- Hover states com scale sutil (1.02), mudança de cor, sombra crescente
- Botões com active:scale-95 para feedback tátil
- Estados de loading elegantes (skeleton com shimmer usando a cor da marca)

Elementos premium específicos:
- Hero com elemento visual marcante (gradient orb usando azul + vermelho da marca, grid sutil, ou noise texture)
- Cards com hover elaborado (gradient border animado usando as cores da marca)
- Botões com variantes (primary azul, danger/destaque vermelho, secondary, ghost)
- Badges e tags usando vermelho para urgência/novidade
- Dark mode bem calibrado — não use preto puro (#0A0A0B é melhor). As cores da marca precisam de versões ajustadas para dark mode (geralmente mais claras/menos saturadas para manter contraste sem agredir os olhos).

Performance e acessibilidade — respeite prefers-reduced-motion, contraste WCAG AA mínimo (atenção especial ao vermelho sobre fundos — pode falhar contraste facilmente), foco visível, lazy loading.

O que entregar:
- Sistema de design tokens centralizado (cores, espaçamentos, tipografia)
- Componentes reutilizáveis e bem estruturados
- Código limpo, semanticamente nomeado
- Documentação rápida da paleta refinada antes de aplicar

Referências estéticas: linear.app, vercel.com, stripe.com, arc.net, framer.com, raycast.com, resend.com.
```

---

## Checklist de Release V1

- [ ] #1 — Download XML funcionando
- [ ] #2 — Modal de confirmação para anonimizar
- [ ] #3 — `router.refresh()` no modal de decisão
- [ ] #4 — Capturar foto com Enter
- [ ] #5 — Página `/cliente/perfil`
- [ ] #6 — Cadastro inline de depositante
- [ ] #7 — Métricas do dashboard (dois tempos + filtro de período)
- [ ] #8 — Export XLSX do histórico
- [ ] #9 — Logo nos headers autenticados
- [ ] #10 — Remover `formatDate` duplicada
- [ ] #11 — Revisão frontend (aguardando prompt)
- [ ] Testes E2E passando em todos os fluxos
- [ ] Lighthouse > 90 nas rotas principais
- [ ] Edge Functions deployadas e cron configurado
- [ ] Checklist pré-produção do `docs/SETUP.md` completo
