-- =====================================================================
-- Coluna logistics_code (preenchida quando identifier_type = 'logistics_code')
-- e atualização da constraint de consistência do identificador.
-- =====================================================================

alter table returns add column if not exists logistics_code text;

alter table returns drop constraint if exists identifier_consistency;

alter table returns add constraint identifier_consistency check (
  (identifier_type = 'access_key' and access_key is not null
    and postal_code is null and illegible_token is null and logistics_code is null) or
  (identifier_type = 'postal_code' and postal_code is not null
    and access_key is null and illegible_token is null and logistics_code is null) or
  (identifier_type = 'logistics_code' and logistics_code is not null
    and access_key is null and postal_code is null and illegible_token is null) or
  (identifier_type = 'illegible' and illegible_token is not null
    and access_key is null and postal_code is null and logistics_code is null)
);
