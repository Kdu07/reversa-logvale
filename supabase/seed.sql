-- =====================================================================
-- LOGVALE — Seed de dados mockados para desenvolvimento
-- =====================================================================
-- Como executar:
--   A) supabase db reset           (via CLI — roda migrations + seed)
--   B) Colar no SQL Editor do Supabase Dashboard
--
-- Credenciais (senha: Logvale2024):
--   ana.silva@logvale.com.br      → manager
--   carlos.mendes@logvale.com.br  → operator
--   mariana.costa@logvale.com.br  → operator
--   fernanda@techstore.com.br     → client (TechStore + Eletrônicos Brasil)
--   roberto@moveispremium.com.br  → client (Móveis Premium + Eletrônicos Brasil)
-- =====================================================================

do $$
declare
  -- Usuários
  v_manager uuid := 'a0000000-0000-0000-0000-000000000001';
  v_op1     uuid := 'a0000000-0000-0000-0000-000000000002';
  v_op2     uuid := 'a0000000-0000-0000-0000-000000000003';
  v_cli1    uuid := 'a0000000-0000-0000-0000-000000000004';
  v_cli2    uuid := 'a0000000-0000-0000-0000-000000000005';

  -- Depositantes
  v_dep1 uuid := 'b0000000-0000-0000-0000-000000000001'; -- TechStore
  v_dep2 uuid := 'b0000000-0000-0000-0000-000000000002'; -- Eletrônicos Brasil
  v_dep3 uuid := 'b0000000-0000-0000-0000-000000000003'; -- Móveis Premium

  -- Devoluções
  v_r01 uuid := 'c0000000-0000-0000-0000-000000000001';
  v_r02 uuid := 'c0000000-0000-0000-0000-000000000002';
  v_r03 uuid := 'c0000000-0000-0000-0000-000000000003';
  v_r04 uuid := 'c0000000-0000-0000-0000-000000000004';
  v_r05 uuid := 'c0000000-0000-0000-0000-000000000005';
  v_r06 uuid := 'c0000000-0000-0000-0000-000000000006';
  v_r07 uuid := 'c0000000-0000-0000-0000-000000000007';
  v_r08 uuid := 'c0000000-0000-0000-0000-000000000008';
  v_r09 uuid := 'c0000000-0000-0000-0000-000000000009';
  v_r10 uuid := 'c0000000-0000-0000-0000-000000000010';
  v_r11 uuid := 'c0000000-0000-0000-0000-000000000011';
  v_r12 uuid := 'c0000000-0000-0000-0000-000000000012';
  v_r13 uuid := 'c0000000-0000-0000-0000-000000000013';
  v_r14 uuid := 'c0000000-0000-0000-0000-000000000014';
  v_r15 uuid := 'c0000000-0000-0000-0000-000000000015';
  v_r16 uuid := 'c0000000-0000-0000-0000-000000000016';
  v_r17 uuid := 'c0000000-0000-0000-0000-000000000017';
  v_r18 uuid := 'c0000000-0000-0000-0000-000000000018';
  v_r19 uuid := 'c0000000-0000-0000-0000-000000000019';
  v_r20 uuid := 'c0000000-0000-0000-0000-000000000020';

  -- Chaves de acesso NF-e (44 dígitos)
  v_ak01 text := '11111111111111111111111111111111111111111111';
  v_ak02 text := '22222222222222222222222222222222222222222222';
  v_ak03 text := '33333333333333333333333333333333333333333333';
  v_ak04 text := '44444444444444444444444444444444444444444444';
  v_ak05 text := '55555555555555555555555555555555555555555555';
  v_ak06 text := '66666666666666666666666666666666666666666666';
  v_ak07 text := '77777777777777777777777777777777777777777777';
  v_ak08 text := '88888888888888888888888888888888888888888888';
  v_ak09 text := '99999999999999999999999999999999999999999999';

  v_pwd text;

begin

  v_pwd := crypt('Logvale2024', gen_salt('bf', 10));

  -- ===================================================================
  -- 1. auth.users
  -- ===================================================================
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, confirmation_token,
    email_change, email_change_token_new, recovery_token
  ) values
    ('00000000-0000-0000-0000-000000000000', v_manager,
     'authenticated', 'authenticated', 'ana.silva@logvale.com.br', v_pwd, now(),
     '{"provider":"email","providers":["email"]}', '{}',
     now() - interval '60 days', now(), '', '', '', ''),

    ('00000000-0000-0000-0000-000000000000', v_op1,
     'authenticated', 'authenticated', 'carlos.mendes@logvale.com.br', v_pwd, now(),
     '{"provider":"email","providers":["email"]}', '{}',
     now() - interval '55 days', now(), '', '', '', ''),

    ('00000000-0000-0000-0000-000000000000', v_op2,
     'authenticated', 'authenticated', 'mariana.costa@logvale.com.br', v_pwd, now(),
     '{"provider":"email","providers":["email"]}', '{}',
     now() - interval '50 days', now(), '', '', '', ''),

    ('00000000-0000-0000-0000-000000000000', v_cli1,
     'authenticated', 'authenticated', 'fernanda@techstore.com.br', v_pwd, now(),
     '{"provider":"email","providers":["email"]}', '{}',
     now() - interval '45 days', now(), '', '', '', ''),

    ('00000000-0000-0000-0000-000000000000', v_cli2,
     'authenticated', 'authenticated', 'roberto@moveispremium.com.br', v_pwd, now(),
     '{"provider":"email","providers":["email"]}', '{}',
     now() - interval '40 days', now(), '', '', '', '')

  on conflict (id) do nothing;

  -- ===================================================================
  -- 2. auth.identities
  -- ===================================================================
  insert into auth.identities (
    provider_id, user_id, identity_data, provider,
    last_sign_in_at, created_at, updated_at
  ) values
    ('ana.silva@logvale.com.br', v_manager,
     jsonb_build_object('sub', v_manager::text, 'email', 'ana.silva@logvale.com.br', 'email_verified', true),
     'email', now(), now() - interval '60 days', now()),

    ('carlos.mendes@logvale.com.br', v_op1,
     jsonb_build_object('sub', v_op1::text, 'email', 'carlos.mendes@logvale.com.br', 'email_verified', true),
     'email', now(), now() - interval '55 days', now()),

    ('mariana.costa@logvale.com.br', v_op2,
     jsonb_build_object('sub', v_op2::text, 'email', 'mariana.costa@logvale.com.br', 'email_verified', true),
     'email', now(), now() - interval '50 days', now()),

    ('fernanda@techstore.com.br', v_cli1,
     jsonb_build_object('sub', v_cli1::text, 'email', 'fernanda@techstore.com.br', 'email_verified', true),
     'email', now(), now() - interval '45 days', now()),

    ('roberto@moveispremium.com.br', v_cli2,
     jsonb_build_object('sub', v_cli2::text, 'email', 'roberto@moveispremium.com.br', 'email_verified', true),
     'email', now(), now() - interval '40 days', now())

  on conflict do nothing;

  -- ===================================================================
  -- 3. profiles
  -- ===================================================================
  insert into profiles (id, role, full_name, phone, active, terms_accepted_at, created_at, updated_at)
  values
    (v_manager, 'manager',  'Ana Silva',      '11 98765-4321', true, now() - interval '60 days', now() - interval '60 days', now()),
    (v_op1,     'operator', 'Carlos Mendes',  '11 97654-3210', true, now() - interval '55 days', now() - interval '55 days', now()),
    (v_op2,     'operator', 'Mariana Costa',  '11 96543-2109', true, now() - interval '50 days', now() - interval '50 days', now()),
    (v_cli1,    'client',   'Fernanda Gomes', '21 98888-1111', true, now() - interval '45 days', now() - interval '45 days', now()),
    (v_cli2,    'client',   'Roberto Lima',   '41 97777-2222', true, now() - interval '40 days', now() - interval '40 days', now())
  on conflict (id) do nothing;

  -- ===================================================================
  -- 4. depositors
  -- ===================================================================
  insert into depositors (id, cnpj, razao_social, active, created_at, updated_at)
  values
    (v_dep1, '12345678000195', 'TechStore Distribuidora LTDA', true, now() - interval '60 days', now()),
    (v_dep2, '98765432000100', 'Eletrônicos Brasil S.A.',      true, now() - interval '60 days', now()),
    (v_dep3, '11111111000191', 'Móveis Premium LTDA',          true, now() - interval '60 days', now())
  on conflict (id) do nothing;

  -- ===================================================================
  -- 5. client_depositors
  --   Fernanda → TechStore, Eletrônicos Brasil
  --   Roberto  → Móveis Premium, Eletrônicos Brasil
  -- ===================================================================
  insert into client_depositors (client_id, depositor_id, created_at)
  values
    (v_cli1, v_dep1, now() - interval '45 days'),
    (v_cli1, v_dep2, now() - interval '45 days'),
    (v_cli2, v_dep3, now() - interval '40 days'),
    (v_cli2, v_dep2, now() - interval '40 days')
  on conflict do nothing;

  -- ===================================================================
  -- 6. invoice_cache (5 NFs consultadas na Webmania)
  -- ===================================================================
  insert into invoice_cache (access_key, xml_url, emitter_cnpj, invoice_number, emitted_at, raw_response, fetched_at)
  values
    (v_ak01, 'invoice-xmls/ak/' || v_ak01 || '.xml', '12345678000195', '000001',
     now() - interval '10 days', '{"status":"aprovado","nfe":{"nProt":"123456789012345"}}'::jsonb,
     now() - interval '1 hour'),

    (v_ak02, 'invoice-xmls/ak/' || v_ak02 || '.xml', '98765432000100', '000002',
     now() - interval '8 days', '{"status":"aprovado","nfe":{"nProt":"123456789012346"}}'::jsonb,
     now() - interval '12 hours'),

    (v_ak03, 'invoice-xmls/ak/' || v_ak03 || '.xml', '11111111000191', '000003',
     now() - interval '5 days', '{"status":"aprovado","nfe":{"nProt":"123456789012347"}}'::jsonb,
     now() - interval '36 hours'),

    (v_ak04, 'invoice-xmls/ak/' || v_ak04 || '.xml', '12345678000195', '000004',
     now() - interval '7 days', '{"status":"aprovado","nfe":{"nProt":"123456789012348"}}'::jsonb,
     now() - interval '62 hours'),

    (v_ak05, 'invoice-xmls/ak/' || v_ak05 || '.xml', '12345678000195', '000005',
     now() - interval '6 days', '{"status":"aprovado","nfe":{"nProt":"123456789012349"}}'::jsonb,
     now() - interval '5 days')

  on conflict do nothing;

  -- ===================================================================
  -- 7. returns — awaiting_decision (7)
  -- r05 e r06 estão há >48h pendentes → aparecem na view returns_needing_warning
  -- ===================================================================
  insert into returns (
    id, identifier_type, access_key, postal_code, illegible_token,
    rv, item_count, depositor_id, invoice_xml_url,
    status, received_at, received_by,
    decision, decided_at, decided_by, decided_by_type, return_invoice_xml_url,
    processed_at, processed_by, warning_sent_at, created_at, updated_at
  ) values

  (v_r01, 'access_key', v_ak01, null, null,
   'RV2024001', 3, v_dep1, 'invoice-xmls/ak/' || v_ak01 || '.xml',
   'awaiting_decision', now() - interval '1 hour', v_op1,
   null, null, null, null, null,
   null, null, null,
   now() - interval '1 hour', now() - interval '1 hour'),

  (v_r02, 'access_key', v_ak02, null, null,
   'RV2024002', 2, v_dep2, 'invoice-xmls/ak/' || v_ak02 || '.xml',
   'awaiting_decision', now() - interval '12 hours', v_op2,
   null, null, null, null, null,
   null, null, null,
   now() - interval '12 hours', now() - interval '12 hours'),

  (v_r03, 'postal_code', null, '01310-100', null,
   'RV2024003', 5, v_dep1, null,
   'awaiting_decision', now() - interval '24 hours', v_op1,
   null, null, null, null, null,
   null, null, null,
   now() - interval '24 hours', now() - interval '24 hours'),

  (v_r04, 'access_key', v_ak03, null, null,
   'RV2024004', 1, v_dep3, 'invoice-xmls/ak/' || v_ak03 || '.xml',
   'awaiting_decision', now() - interval '36 hours', v_op2,
   null, null, null, null, null,
   null, null, null,
   now() - interval '36 hours', now() - interval '36 hours'),

  -- >48h, sem warning enviado → aparece em returns_needing_warning
  (v_r05, 'illegible', null, null, 'ILLEGIVEL-001',
   'RV2024005', 4, v_dep2, null,
   'awaiting_decision', now() - interval '50 hours', v_op1,
   null, null, null, null, null,
   null, null, null,
   now() - interval '50 hours', now() - interval '50 hours'),

  -- >48h, sem warning enviado → aparece em returns_needing_warning
  (v_r06, 'access_key', v_ak04, null, null,
   'RV2024006', 3, v_dep1, 'invoice-xmls/ak/' || v_ak04 || '.xml',
   'awaiting_decision', now() - interval '62 hours', v_op2,
   null, null, null, null, null,
   null, null, null,
   now() - interval '62 hours', now() - interval '62 hours'),

  (v_r07, 'postal_code', null, '04567-890', null,
   'RV2024007', 2, v_dep3, null,
   'awaiting_decision', now() - interval '3 hours', v_op1,
   null, null, null, null, null,
   null, null, null,
   now() - interval '3 hours', now() - interval '3 hours')

  on conflict (id) do nothing;

  -- ===================================================================
  -- 7b. returns — decided (7)
  -- Cobre todos os 4 tipos de decisão + mix de client/auto
  -- ===================================================================
  insert into returns (
    id, identifier_type, access_key, postal_code, illegible_token,
    rv, item_count, depositor_id, invoice_xml_url,
    status, received_at, received_by,
    decision, decided_at, decided_by, decided_by_type, return_invoice_xml_url,
    processed_at, processed_by, warning_sent_at, created_at, updated_at
  ) values

  (v_r08, 'access_key', v_ak05, null, null,
   'RV2024008', 2, v_dep1, 'invoice-xmls/ak/' || v_ak05 || '.xml',
   'decided', now() - interval '5 days', v_op1,
   'return_to_stock', now() - interval '108 hours', v_cli1, 'client',
   'invoice-xmls/returns/RV2024008/return-nf.xml',
   null, null, null,
   now() - interval '5 days', now() - interval '108 hours'),

  (v_r09, 'postal_code', null, '20040-020', null,
   'RV2024009', 3, v_dep2, null,
   'decided', now() - interval '5 days', v_op2,
   'store_for_handling', now() - interval '4 days', null, 'auto', null,
   null, null, null,
   now() - interval '5 days', now() - interval '4 days'),

  (v_r10, 'access_key', v_ak06, null, null,
   'RV2024010', 4, v_dep1, 'invoice-xmls/ak/' || v_ak06 || '.xml',
   'decided', now() - interval '4 days', v_op1,
   'discard', now() - interval '3 days', v_cli1, 'client',
   'invoice-xmls/returns/RV2024010/return-nf.xml',
   null, null, null,
   now() - interval '4 days', now() - interval '3 days'),

  (v_r11, 'access_key', v_ak07, null, null,
   'RV2024011', 1, v_dep3, 'invoice-xmls/ak/' || v_ak07 || '.xml',
   'decided', now() - interval '7 days', v_op2,
   'repackage', now() - interval '6 days', v_cli2, 'client',
   'invoice-xmls/returns/RV2024011/return-nf.xml',
   null, null, null,
   now() - interval '7 days', now() - interval '6 days'),

  (v_r12, 'illegible', null, null, 'ILLEGIVEL-002',
   'RV2024012', 5, v_dep2, null,
   'decided', now() - interval '8 days', v_op1,
   'store_for_handling', now() - interval '7 days', null, 'auto', null,
   null, null, now() - interval '8 days',
   now() - interval '8 days', now() - interval '7 days'),

  (v_r13, 'postal_code', null, '30140-071', null,
   'RV2024013', 2, v_dep1, null,
   'decided', now() - interval '10 days', v_op2,
   'store_for_handling', now() - interval '9 days', v_cli1, 'client', null,
   null, null, null,
   now() - interval '10 days', now() - interval '9 days'),

  (v_r14, 'postal_code', null, '80010-010', null,
   'RV2024014', 3, v_dep3, null,
   'decided', now() - interval '12 days', v_op1,
   'discard', now() - interval '11 days', v_cli2, 'client',
   'invoice-xmls/returns/RV2024014/return-nf.xml',
   null, null, null,
   now() - interval '12 days', now() - interval '11 days')

  on conflict (id) do nothing;

  -- ===================================================================
  -- 7c. returns — processed (6)
  -- ===================================================================
  insert into returns (
    id, identifier_type, access_key, postal_code, illegible_token,
    rv, item_count, depositor_id, invoice_xml_url,
    status, received_at, received_by,
    decision, decided_at, decided_by, decided_by_type, return_invoice_xml_url,
    processed_at, processed_by, warning_sent_at, created_at, updated_at
  ) values

  (v_r15, 'access_key', v_ak08, null, null,
   'RV2024015', 2, v_dep1, 'invoice-xmls/ak/' || v_ak08 || '.xml',
   'processed', now() - interval '15 days', v_op1,
   'return_to_stock', now() - interval '14 days', v_cli1, 'client',
   'invoice-xmls/returns/RV2024015/return-nf.xml',
   now() - interval '13 days', v_op2, null,
   now() - interval '15 days', now() - interval '13 days'),

  (v_r16, 'postal_code', null, '70040-010', null,
   'RV2024016', 3, v_dep2, null,
   'processed', now() - interval '20 days', v_op2,
   'discard', now() - interval '19 days', v_cli1, 'client',
   'invoice-xmls/returns/RV2024016/return-nf.xml',
   now() - interval '18 days', v_op1, null,
   now() - interval '20 days', now() - interval '18 days'),

  (v_r17, 'illegible', null, null, 'ILLEGIVEL-003',
   'RV2024017', 4, v_dep3, null,
   'processed', now() - interval '12 days', v_op1,
   'store_for_handling', now() - interval '11 days', null, 'auto', null,
   now() - interval '10 days', v_op2, null,
   now() - interval '12 days', now() - interval '10 days'),

  (v_r18, 'access_key', v_ak09, null, null,
   'RV2024018', 1, v_dep1, 'invoice-xmls/ak/' || v_ak09 || '.xml',
   'processed', now() - interval '25 days', v_op2,
   'repackage', now() - interval '24 days', v_cli1, 'client',
   'invoice-xmls/returns/RV2024018/return-nf.xml',
   now() - interval '23 days', v_op1, null,
   now() - interval '25 days', now() - interval '23 days'),

  (v_r19, 'postal_code', null, '01001-000', null,
   'RV2024019', 2, v_dep2, null,
   'processed', now() - interval '18 days', v_op1,
   'return_to_stock', now() - interval '17 days', v_cli1, 'client',
   'invoice-xmls/returns/RV2024019/return-nf.xml',
   now() - interval '16 days', v_op2, null,
   now() - interval '18 days', now() - interval '16 days'),

  (v_r20, 'postal_code', null, '89201-005', null,
   'RV2024020', 5, v_dep3, null,
   'processed', now() - interval '30 days', v_op2,
   'discard', now() - interval '28 days', v_cli2, 'client',
   'invoice-xmls/returns/RV2024020/return-nf.xml',
   now() - interval '27 days', v_op1, null,
   now() - interval '30 days', now() - interval '27 days')

  on conflict (id) do nothing;

  -- ===================================================================
  -- 8. return_photos (40 fotos — 2 box + 2 item para as primeiras 10 devoluções)
  -- Paths são placeholders; arquivos reais não existem no Storage.
  -- ===================================================================
  insert into return_photos (return_id, photo_type, storage_path, position, created_at)
  values
    -- r01
    (v_r01, 'box',  'returns/c0000000-0000-0000-0000-000000000001/box/0.jpg',  0, now() - interval '1 hour'),
    (v_r01, 'box',  'returns/c0000000-0000-0000-0000-000000000001/box/1.jpg',  1, now() - interval '1 hour'),
    (v_r01, 'item', 'returns/c0000000-0000-0000-0000-000000000001/item/0.jpg', 0, now() - interval '1 hour'),
    (v_r01, 'item', 'returns/c0000000-0000-0000-0000-000000000001/item/1.jpg', 1, now() - interval '1 hour'),
    -- r02
    (v_r02, 'box',  'returns/c0000000-0000-0000-0000-000000000002/box/0.jpg',  0, now() - interval '12 hours'),
    (v_r02, 'box',  'returns/c0000000-0000-0000-0000-000000000002/box/1.jpg',  1, now() - interval '12 hours'),
    (v_r02, 'item', 'returns/c0000000-0000-0000-0000-000000000002/item/0.jpg', 0, now() - interval '12 hours'),
    (v_r02, 'item', 'returns/c0000000-0000-0000-0000-000000000002/item/1.jpg', 1, now() - interval '12 hours'),
    -- r03
    (v_r03, 'box',  'returns/c0000000-0000-0000-0000-000000000003/box/0.jpg',  0, now() - interval '24 hours'),
    (v_r03, 'box',  'returns/c0000000-0000-0000-0000-000000000003/box/1.jpg',  1, now() - interval '24 hours'),
    (v_r03, 'item', 'returns/c0000000-0000-0000-0000-000000000003/item/0.jpg', 0, now() - interval '24 hours'),
    (v_r03, 'item', 'returns/c0000000-0000-0000-0000-000000000003/item/1.jpg', 1, now() - interval '24 hours'),
    -- r04
    (v_r04, 'box',  'returns/c0000000-0000-0000-0000-000000000004/box/0.jpg',  0, now() - interval '36 hours'),
    (v_r04, 'box',  'returns/c0000000-0000-0000-0000-000000000004/box/1.jpg',  1, now() - interval '36 hours'),
    (v_r04, 'item', 'returns/c0000000-0000-0000-0000-000000000004/item/0.jpg', 0, now() - interval '36 hours'),
    (v_r04, 'item', 'returns/c0000000-0000-0000-0000-000000000004/item/1.jpg', 1, now() - interval '36 hours'),
    -- r05
    (v_r05, 'box',  'returns/c0000000-0000-0000-0000-000000000005/box/0.jpg',  0, now() - interval '50 hours'),
    (v_r05, 'box',  'returns/c0000000-0000-0000-0000-000000000005/box/1.jpg',  1, now() - interval '50 hours'),
    (v_r05, 'item', 'returns/c0000000-0000-0000-0000-000000000005/item/0.jpg', 0, now() - interval '50 hours'),
    (v_r05, 'item', 'returns/c0000000-0000-0000-0000-000000000005/item/1.jpg', 1, now() - interval '50 hours'),
    -- r06
    (v_r06, 'box',  'returns/c0000000-0000-0000-0000-000000000006/box/0.jpg',  0, now() - interval '62 hours'),
    (v_r06, 'box',  'returns/c0000000-0000-0000-0000-000000000006/box/1.jpg',  1, now() - interval '62 hours'),
    (v_r06, 'item', 'returns/c0000000-0000-0000-0000-000000000006/item/0.jpg', 0, now() - interval '62 hours'),
    (v_r06, 'item', 'returns/c0000000-0000-0000-0000-000000000006/item/1.jpg', 1, now() - interval '62 hours'),
    -- r07
    (v_r07, 'box',  'returns/c0000000-0000-0000-0000-000000000007/box/0.jpg',  0, now() - interval '3 hours'),
    (v_r07, 'box',  'returns/c0000000-0000-0000-0000-000000000007/box/1.jpg',  1, now() - interval '3 hours'),
    (v_r07, 'item', 'returns/c0000000-0000-0000-0000-000000000007/item/0.jpg', 0, now() - interval '3 hours'),
    (v_r07, 'item', 'returns/c0000000-0000-0000-0000-000000000007/item/1.jpg', 1, now() - interval '3 hours'),
    -- r08
    (v_r08, 'box',  'returns/c0000000-0000-0000-0000-000000000008/box/0.jpg',  0, now() - interval '5 days'),
    (v_r08, 'box',  'returns/c0000000-0000-0000-0000-000000000008/box/1.jpg',  1, now() - interval '5 days'),
    (v_r08, 'item', 'returns/c0000000-0000-0000-0000-000000000008/item/0.jpg', 0, now() - interval '5 days'),
    (v_r08, 'item', 'returns/c0000000-0000-0000-0000-000000000008/item/1.jpg', 1, now() - interval '5 days'),
    -- r09
    (v_r09, 'box',  'returns/c0000000-0000-0000-0000-000000000009/box/0.jpg',  0, now() - interval '5 days'),
    (v_r09, 'box',  'returns/c0000000-0000-0000-0000-000000000009/box/1.jpg',  1, now() - interval '5 days'),
    (v_r09, 'item', 'returns/c0000000-0000-0000-0000-000000000009/item/0.jpg', 0, now() - interval '5 days'),
    (v_r09, 'item', 'returns/c0000000-0000-0000-0000-000000000009/item/1.jpg', 1, now() - interval '5 days'),
    -- r10
    (v_r10, 'box',  'returns/c0000000-0000-0000-0000-000000000010/box/0.jpg',  0, now() - interval '4 days'),
    (v_r10, 'box',  'returns/c0000000-0000-0000-0000-000000000010/box/1.jpg',  1, now() - interval '4 days'),
    (v_r10, 'item', 'returns/c0000000-0000-0000-0000-000000000010/item/0.jpg', 0, now() - interval '4 days'),
    (v_r10, 'item', 'returns/c0000000-0000-0000-0000-000000000010/item/1.jpg', 1, now() - interval '4 days');

end;
$$;

-- =====================================================================
-- Verificação rápida (execute separadamente após o seed):
-- =====================================================================
-- select 'profiles'       as tabela, count(*) from profiles
-- union all select 'depositors',    count(*) from depositors
-- union all select 'client_dep.',   count(*) from client_depositors
-- union all select 'invoice_cache', count(*) from invoice_cache
-- union all select 'returns',       count(*) from returns
-- union all select 'return_photos', count(*) from return_photos;
--
-- select status, count(*) from returns group by status order by status;
-- select * from returns_needing_warning;  -- deve retornar 2 linhas (r05, r06)
