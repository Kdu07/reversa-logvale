# LGPD — Procedimentos Operacionais

## 1. Retenção de Dados

| Tipo de dado | Prazo | Base legal |
|---|---|---|
| Dados de devolução (RV, datas, decisões) | 5 anos após processamento | Obrigação fiscal / LGPD art. 16 |
| Fotografias (embalagem e itens) | 1 ano após processamento | Necessidade operacional — removidas automaticamente pelo `photo-cleanup-job` |
| Dados de perfil (nome, e-mail, telefone) | Enquanto ativo; anonimizados sob demanda | Execução contratual |
| Registros de acesso (logs Supabase) | 6 meses | Marco Civil da Internet (art. 15) |

---

## 2. Exportação de Dados (Portabilidade)

O gerente pode exportar os dados pessoais de qualquer usuário diretamente pela tela `/admin/usuarios`.

### Como usar
1. Acessar `/admin/usuarios`
2. Localizar o usuário na tabela
3. Clicar em **Exportar dados** na linha do usuário
4. O navegador fará download de um arquivo `.zip`

### Conteúdo do ZIP

```
export_<uid-prefix>_<data>.zip
├── perfil.json        — nome, telefone, função, e-mail, último login, data de criação
├── devolucoes.json    — array com todos os registros de devolução do usuário
└── consentimento.json — data/hora do aceite dos termos + data da exportação
```

### Dados preservados para obrigação legal
Os dados em `devolucoes.json` (RV, datas, decisões) são registros fiscais e não são removidos mesmo após anonimização (LGPD art. 16, II).

---

## 3. Anonimização de Usuário

A anonimização substitui os dados identificadores por valores neutros, sem excluir o registro. Isso preserva a integridade referencial e cumpre obrigações fiscais.

### Como usar
1. Acessar `/admin/usuarios`
2. Localizar o usuário ativo
3. Clicar em **Anonimizar** — uma confirmação será exibida
4. Confirmar a ação

### O que é anonimizado
| Campo | Antes | Depois |
|---|---|---|
| `profiles.full_name` | "João Silva" | "[ANONIMIZADO]" |
| `profiles.phone` | "+55 21 99999-9999" | `null` |
| `profiles.active` | `true` | `false` |
| `auth.users.email` | "joao@empresa.com" | "anon-{uuid}@logvale.local" |

### O que é preservado
- Tabela `returns` — todos os registros de devolução (RV, datas, decisões, `depositor_id`)
- Tabela `return_photos` — fotos preservadas até remoção automática pelo job diário
- Timestamps de auditoria (`created_at`, `terms_accepted_at`)

### Efeito no acesso
O usuário fica imediatamente sem acesso: o middleware rejeita contas inativas e o e-mail substituído impede geração de magic link.

---

## 4. Atendimento a Solicitações de Titulares

Quando um usuário solicitar o exercício dos seus direitos LGPD (por e-mail para `privacidade@logvale.com.br`):

| Direito | Ação do gerente | Prazo |
|---|---|---|
| Acesso | Usar "Exportar dados" e encaminhar o ZIP | 15 dias úteis |
| Correção | Editar o usuário na tela `/admin/usuarios` | Imediato |
| Portabilidade | Usar "Exportar dados" | 15 dias úteis |
| Anonimização/encerramento | Usar "Anonimizar" | 15 dias úteis |
| Revogação de consentimento | Desativar conta (toggle) ou anonimizar | Imediato |

---

## 5. Incidentes de Segurança

Em caso de incidente que envolva dados pessoais (vazamento, acesso não autorizado, perda de dados):

1. Isolar imediatamente o acesso suspeito (desabilitar a conta no Supabase Dashboard)
2. Documentar: data/hora, sistemas afetados, dados envolvidos, número estimado de titulares
3. Notificar a ANPD em até **72 horas** após a ciência do incidente
   - Portal da ANPD: [https://www.gov.br/anpd](https://www.gov.br/anpd)
4. Notificar os titulares afetados caso o incidente possa causar risco relevante
5. Registrar o incidente internamente com todas as ações tomadas

---

## 6. Encarregado de Dados (DPO)

Contato do Encarregado de Proteção de Dados: **privacidade@logvale.com.br**
