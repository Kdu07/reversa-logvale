# Credenciais de Desenvolvimento

Todos os usuários abaixo são criados pelo `supabase/seed.sql`.  
**Senha padrão:** `Logvale2024`

---

## Usuários

| Role     | Nome              | E-mail                        | Senha       |
|----------|-------------------|-------------------------------|-------------|
| Manager  | Ana Silva         | ana.silva@logvale.com.br      | Logvale2024 |
| Operator | Carlos Mendes     | carlos.mendes@logvale.com.br  | Logvale2024 |
| Operator | Mariana Costa     | mariana.costa@logvale.com.br  | Logvale2024 |
| Client   | Fernanda Gomes    | fernanda@techstore.com.br     | Logvale2024 |
| Client   | Roberto Lima      | roberto@moveispremium.com.br  | Logvale2024 |

---

## Depositantes

| CNPJ           | Razão Social                  |
|----------------|-------------------------------|
| 12345678000195 | TechStore Distribuidora LTDA  |
| 98765432000100 | Eletrônicos Brasil S.A.       |
| 11111111000191 | Móveis Premium LTDA           |

---

## Associações Cliente ↔ Depositante

| Cliente        | Depositantes                                      |
|----------------|---------------------------------------------------|
| Fernanda Gomes | TechStore Distribuidora LTDA, Eletrônicos Brasil S.A. |
| Roberto Lima   | Móveis Premium LTDA, Eletrônicos Brasil S.A.      |

---

## Devoluções (20 registros)

| RV          | Status             | Depositante            | Tipo ID      | Itens |
|-------------|--------------------|------------------------|--------------|-------|
| RV2024001   | awaiting_decision  | TechStore              | access_key   | 3     |
| RV2024002   | awaiting_decision  | Eletrônicos Brasil     | access_key   | 2     |
| RV2024003   | awaiting_decision  | TechStore              | postal_code  | 5     |
| RV2024004   | awaiting_decision  | Móveis Premium         | access_key   | 1     |
| RV2024005   | awaiting_decision  | Eletrônicos Brasil     | illegible    | 4     |
| RV2024006   | awaiting_decision  | TechStore              | access_key   | 3     |
| RV2024007   | awaiting_decision  | Móveis Premium         | postal_code  | 2     |
| RV2024008   | decided            | TechStore              | access_key   | 2     |
| RV2024009   | decided            | Eletrônicos Brasil     | postal_code  | 3     |
| RV2024010   | decided            | TechStore              | access_key   | 4     |
| RV2024011   | decided            | Móveis Premium         | access_key   | 1     |
| RV2024012   | decided            | Eletrônicos Brasil     | illegible    | 5     |
| RV2024013   | decided            | TechStore              | postal_code  | 2     |
| RV2024014   | decided            | Móveis Premium         | postal_code  | 3     |
| RV2024015   | processed          | TechStore              | access_key   | 2     |
| RV2024016   | processed          | Eletrônicos Brasil     | postal_code  | 3     |
| RV2024017   | processed          | Móveis Premium         | illegible    | 4     |
| RV2024018   | processed          | TechStore              | access_key   | 1     |
| RV2024019   | processed          | Eletrônicos Brasil     | postal_code  | 2     |
| RV2024020   | processed          | Móveis Premium         | postal_code  | 5     |

> RV2024005 e RV2024006 estão há mais de 48h pendentes — aparecem na view `returns_needing_warning`.
