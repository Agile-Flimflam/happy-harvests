-- Restructure external_integrations to be provider-agnostic
-- - Add credential_* columns (ciphertext, iv, tag)
-- - Add settings JSONB for per-service configuration
-- - Backfill credential_* from legacy api_key_* columns
-- - Drop legacy api_key_* columns and api_key_hint

begin;

-- New generic credential columns
alter table public.external_integrations
  add column if not exists credential_ciphertext text,
  add column if not exists credential_iv text,
  add column if not exists credential_tag text,
  add column if not exists settings jsonb;

-- Backfill credential_* from legacy api_key_* where present
update public.external_integrations
set
  credential_ciphertext = coalesce(credential_ciphertext, api_key_ciphertext),
  credential_iv = coalesce(credential_iv, api_key_iv),
  credential_tag = coalesce(credential_tag, api_key_tag)
where api_key_ciphertext is not null or api_key_iv is not null or api_key_tag is not null;

-- Drop legacy hint and key columns
alter table public.external_integrations
  drop column if exists api_key_hint,
  drop column if exists api_key_ciphertext,
  drop column if exists api_key_iv,
  drop column if exists api_key_tag;

commit;


