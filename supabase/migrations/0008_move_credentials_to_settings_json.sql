-- Move encrypted credentials into settings.secrets and drop credential_* columns

begin;

-- Ensure settings column exists
alter table public.external_integrations
  add column if not exists settings jsonb;

-- Initialize settings as empty object where null
update public.external_integrations
set settings = '{}'::jsonb
where settings is null;

-- Backfill credentials into settings.secrets.default
update public.external_integrations
set settings = jsonb_set(
  settings,
  '{secrets,default}',
  jsonb_build_object(
    'ciphertextB64', credential_ciphertext,
    'ivB64', credential_iv,
    'tagB64', credential_tag
  ),
  true
)
where credential_ciphertext is not null and credential_iv is not null and credential_tag is not null;

-- Drop old columns
alter table public.external_integrations
  drop column if exists credential_ciphertext,
  drop column if exists credential_iv,
  drop column if exists credential_tag;

commit;
