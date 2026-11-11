-- =====================================================================
-- Nova decisão do cliente: "Reenvio" (reship) — o mesmo pedido é
-- reenviado ao cliente final, com a mesma NF. Disponível só para os
-- depositantes listados em RESHIP_DEPOSITOR_CNPJS (hoje: Blackskull);
-- a liberação é feita no app (getClientReturnsAction/submitDecisionAction).
-- ADD VALUE de enum precisa estar em transação própria (não pode ser
-- usado como literal antes de commitado) — por isso o contador do
-- dashboard fica na migration seguinte (016).
-- =====================================================================

alter type return_decision add value if not exists 'reship';
