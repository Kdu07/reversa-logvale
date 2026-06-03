# Plano de Melhorias — reversa-logvale

> Cada feature deve ser implementada individualmente. Execute uma de cada vez com Claude Code.

---

## Feature 1 — QR Code para leitura do RV (digitação como fallback)

**Objetivo:** O operador pode escanear o código RV via câmera (QR code) em vez de depender do scanner USB. Digitação manual permanece como fallback.

### Contexto atual

- Arquivo: `app/(operator)/operador/recebimento/steps/step-rv.tsx`
- Hook: `hooks/use-barcode-scanner.ts` — detecta scanner USB via timing de teclas (< 30 ms entre caracteres)
- Fluxo atual: campo de texto focado automaticamente → scanner USB ou digitação manual → Enter avança

### O que fazer

#### 1.1 Instalar biblioteca de QR

```bash
npm install @zxing/browser @zxing/library
```

`@zxing/browser` é a porta oficial do ZXing para browsers — TypeScript-native, suporta QR e barcodes via câmera.

#### 1.2 Criar componente `QrScannerModal`

Novo arquivo: `components/shared/qr-scanner-modal.tsx`

```tsx
// Responsabilidades:
// - Abre a câmera do dispositivo usando BrowserQRCodeReader de @zxing/browser
// - Mostra preview de vídeo ao vivo
// - Ao detectar QR code, chama onScan(decoded) e fecha
// - Botão "Cancelar" fecha sem chamar onScan
// - Trata erros de permissão de câmera com mensagem amigável
// - Lista câmeras disponíveis (frontal / traseira) com selector

interface QrScannerModalProps {
  onScan:  (value: string) => void
  onClose: () => void
}
```

**Comportamento de decodificação:** O QR do RV pode conter o código diretamente ou uma URL com o código — extrair apenas o valor do RV independente do formato.

#### 1.3 Atualizar `step-rv.tsx`

```
ANTES: campo de texto + scanner USB como único método
DEPOIS:
  - Botão "Escanear QR Code" (primário, ícone de câmera) → abre QrScannerModal
  - Campo de texto manual (fallback, label "Digitar manualmente")
  - Scanner USB continua funcionando via useBarcodeScanner (hook existente)
```

Layout proposto para a step:
1. Instrução: "Aponte a câmera para o QR code do RV ou digite manualmente abaixo."
2. Botão grande "Escanear QR Code" (ícone `Camera` do lucide-react) — abre o modal
3. Divisor "ou"
4. Campo de texto + botão "Próximo"

#### 1.4 Arquivos a modificar

| Arquivo | Ação |
|---------|------|
| `package.json` | adicionar `@zxing/browser`, `@zxing/library` |
| `components/shared/qr-scanner-modal.tsx` | **criar** |
| `app/(operator)/operador/recebimento/steps/step-rv.tsx` | atualizar layout + integrar modal |

#### 1.5 Notas de implementação

- O `QrScannerModal` deve limpar o reader (`reader.reset()`) no `useEffect` cleanup para liberar a câmera ao fechar.
- Usar `BrowserQRCodeReader` da lib — não `BrowserMultiFormatReader` — para melhor performance com QR codes.
- Em dispositivos sem câmera (desktop), o botão QR pode aparecer mas o modal exibe mensagem de erro amigável.
- Não remover o hook `useBarcodeScanner` — mantê-lo ativo para scanners USB que ainda são usados.

---

## Feature 2 — Reduzir para 3 botões de decisão com cores vibrantes e descrições

**Objetivo:** Substituir os 4 botões de decisão por 3 botões com cores sólidas e vibrantes. Ao clicar, o modal exibe um texto descritivo explicando a decisão antes da confirmação.

### Contexto atual

4 botões: Estoque / Armazenar / Descarte / Reembalar (mapeados para `return_to_stock`, `store_for_handling`, `discard`, `repackage`)

**ATENÇÃO:** O valor `repackage` existe no banco para registros históricos. **Não remover do tipo `ReturnDecision`** — apenas remover do UI de decisão pendente. Manter suporte de exibição para histórico.

### O que fazer

#### 2.1 Atualizar `lib/decisions.ts`

Adicionar campo `description` ao `DECISION_META` e atualizar labels/cores:

```ts
export const DECISION_DESCRIPTIONS: Partial<Record<ReturnDecision, string>> = {
  return_to_stock: 'Produto avaliado como saudável e em condições de revenda. Será reintegrado ao estoque disponível para venda.',
  store_for_handling: 'O produto será encaminhado para área segregada dentro do galpão para tratativas futuras. Entre em contato com o departamento comercial da Logvale para definir as próximas ações.',
  discard: 'O produto será direcionado para descarte conforme acordado com o cliente. Os termos e condições do descarte são negociados diretamente entre o cliente e o departamento comercial da Logvale.',
}

// Atualizar DECISION_LABELS:
return_to_stock:    'Estoque'
store_for_handling: 'Tratativa'
discard:            'Descarte'
repackage:          'Reembalagem'  // manter para histórico

// Atualizar DECISION_SHORT:
return_to_stock:    'Estoque'
store_for_handling: 'Tratativa'
discard:            'Descarte'
repackage:          'Reembal.'  // manter para histórico

// Atualizar DECISION_BADGE (vibrant):
return_to_stock:    'bg-green-600 text-white border-green-700'
store_for_handling: 'bg-amber-500 text-white border-amber-600'
discard:            'bg-red-600 text-white border-red-700'
repackage:          'bg-blue-500 text-white border-blue-600'  // manter para histórico
```

#### 2.2 Atualizar `app/(client)/cliente/components/returns-table.tsx`

```ts
// ANTES: 4 botões
const DECISION_BUTTONS = [
  { decision: 'return_to_stock',    label: 'Estoque',   variant: 'success'     },
  { decision: 'store_for_handling', label: 'Armazenar', variant: 'warning'     },
  { decision: 'discard',            label: 'Descarte',  variant: 'destructive' },
  { decision: 'repackage',          label: 'Reembalar', variant: 'info'        },
]

// DEPOIS: 3 botões
const DECISION_BUTTONS = [
  { decision: 'return_to_stock',    label: 'Estoque',   color: 'green'  },
  { decision: 'store_for_handling', label: 'Tratativa', color: 'amber'  },
  { decision: 'discard',            label: 'Descarte',  color: 'red'    },
]

// Classes vibrantes (solid, não transparentes):
green: 'bg-green-600 hover:bg-green-700 text-white font-semibold shadow-sm'
amber: 'bg-amber-500 hover:bg-amber-600 text-white font-semibold shadow-sm'
red:   'bg-red-600   hover:bg-red-700   text-white font-semibold shadow-sm'
```

#### 2.3 Atualizar `app/(client)/cliente/components/decision-modal.tsx`

Adicionar bloco de descrição após o badge da decisão e antes do resumo da devolução:

```
Ordem do modal (de cima para baixo):
1. Header + botão fechar
2. Badge da decisão (vibrant, solid)
3. [NOVO] Caixa de descrição — fundo colorido suave, texto explicativo
4. "Esta decisão é irreversível."
5. Resumo da devolução (RV, data, itens, etc.)
6. Upload do XML da NF (quando aplicável)
7. Botões Cancelar / Confirmar
```

A caixa de descrição deve ter estilo visual de destaque:
- `return_to_stock`: borda e fundo verde suave, ícone ✓
- `store_for_handling`: borda e fundo âmbar suave, ícone ⚠
- `discard`: borda e fundo vermelho suave, ícone ✕

#### 2.4 Verificar `needsXml` em `decision-modal.tsx`

```ts
// Lógica atual: XML não é necessário apenas para store_for_handling
const needsXml = (d: ReturnDecision) => d !== 'store_for_handling'
// Manter essa lógica — Estoque e Descarte continuam pedindo XML, Tratativa não.
```

#### 2.5 Verificar `components/shared/decision-pill.tsx`

Atualizar cores do pill para manter consistência com o novo sistema vibrante. O pill é exibido no histórico — manter suporte ao `repackage` para registros antigos.

#### 2.6 Atualizar `lib/i18n/pt-BR.ts` (se aplicável)

Verificar se o arquivo de i18n referenciado em `lib/decisions.ts` precisa ser atualizado com os novos labels.

#### 2.7 Arquivos a modificar

| Arquivo | Ação |
|---------|------|
| `lib/decisions.ts` | Adicionar `DECISION_DESCRIPTIONS`, atualizar labels, cores |
| `lib/i18n/pt-BR.ts` | Atualizar labels de decisão |
| `app/(client)/cliente/components/returns-table.tsx` | Reduzir para 3 botões, cores vibrantes |
| `app/(client)/cliente/components/decision-modal.tsx` | Adicionar bloco de descrição |
| `components/shared/decision-pill.tsx` | Atualizar cores para vibrante |

---

## Feature 3 — Dashboard: "Top Clientes" exibe nome da empresa

**Objetivo:** No painel do gerente, a seção "Top Clientes por Volume" deve exibir o nome da empresa depositante (`depositors.razao_social`), não o nome da pessoa representante (`profiles.full_name`).

### Contexto atual

**Função SQL:** `supabase/migrations/003_dashboard_stats_fn.sql`, linhas 57–71

```sql
-- ATUAL (errado): agrupa por pessoa que decidiu
SELECT jsonb_build_object(
  'name',  COALESCE(p.full_name, 'Desconhecido'),
  'count', COUNT(*)
) AS row
FROM public.returns r
LEFT JOIN public.profiles p ON r.decided_by = p.id
WHERE r.decided_at IS NOT NULL AND r.decided_by_type = 'client'
GROUP BY p.full_name
ORDER BY COUNT(*) DESC
LIMIT 10
```

### O que fazer

#### 3.1 Criar nova migration `004_fix_top_clients.sql`

Arquivo: `supabase/migrations/004_fix_top_clients.sql`

```sql
-- Recria get_dashboard_stats com top_clients agrupado por depositante (empresa)
-- em vez de pela pessoa que decidiu (perfil do cliente).
CREATE OR REPLACE FUNCTION public.get_dashboard_stats(
  p_d1  timestamptz,
  p_d7  timestamptz,
  p_d30 timestamptz,
  p_d48 timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  counts      jsonb;
  top_clients jsonb;
  urgent      jsonb;
BEGIN
  -- [manter verificação de role e todos os outros blocks idênticos]

  -- Top 10 depositantes por volume de devoluções
  SELECT COALESCE(jsonb_agg(row), '[]'::jsonb)
  INTO top_clients
  FROM (
    SELECT jsonb_build_object(
      'name',  COALESCE(d.razao_social, 'Desconhecido'),
      'count', COUNT(*)
    ) AS row
    FROM public.returns r
    LEFT JOIN public.depositors d ON r.depositor_id = d.id
    GROUP BY d.id, d.razao_social
    ORDER BY COUNT(*) DESC
    LIMIT 10
  ) sub;

  -- [manter urgent block e RETURN idênticos]
END;
$$;
```

**Mudança-chave:** 
- `LEFT JOIN public.profiles p ON r.decided_by = p.id` → `LEFT JOIN public.depositors d ON r.depositor_id = d.id`
- `GROUP BY p.full_name` → `GROUP BY d.id, d.razao_social`
- Removido filtro `decided_by_type = 'client'` — mostra volume total de devoluções por empresa, não apenas as decididas

#### 3.2 Aplicar migration

```bash
npx supabase db push
# ou via Supabase Studio em produção
```

#### 3.3 Atualizar label no dashboard (opcional)

Verificar se o título "Top Clientes por Volume" em `app/(manager)/admin/page.tsx` deve ser renomeado para "Top Depositantes por Volume" para refletir melhor o que está sendo exibido.

#### 3.4 Arquivos a modificar

| Arquivo | Ação |
|---------|------|
| `supabase/migrations/004_fix_top_clients.sql` | **criar** — recria a função com join correto |
| `app/(manager)/admin/page.tsx` | Atualizar label se necessário |

---

## Ordem de execução recomendada

| Prioridade | Feature | Complexidade | Risco |
|-----------|---------|-------------|-------|
| 1° | Feature 3 — Dashboard nome empresa | Baixa | Baixo (SQL + label) |
| 2° | Feature 2 — Botões de decisão | Média | Médio (UI + modal) |
| 3° | Feature 1 — QR Code scanner | Alta | Baixo (feature additive) |

Começar pela Feature 3 porque é a mais simples e isolada (uma migration SQL + possível label change).

---

## Observações gerais

- **Não remover `repackage` do tipo `ReturnDecision`** — existem registros históricos no banco. Manter no type e nas funções de display, apenas remover do array de botões de decisão pendente.
- **Migração SQL (Feature 3):** Se o projeto usa Supabase local para dev, rodar `npx supabase db push`. Se direto em produção, executar o SQL pelo Supabase Studio.
- **QR library (Feature 1):** `@zxing/browser` requer que o contexto seja HTTPS ou localhost para acesso à câmera — funciona em produção (Vercel = HTTPS) e em dev local (localhost:3000).
