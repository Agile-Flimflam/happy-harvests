-- Create table for managing external service integrations and secrets
-- Uses app-layer encryption (AES-256-GCM). We only store ciphertext and metadata.

create table if not exists public.external_integrations (
  id uuid primary key default gen_random_uuid(),
  service text not null unique,
  enabled boolean not null default false,
  api_key_ciphertext text,
  api_key_iv text,
  api_key_tag text,
  api_key_hint text, -- last 4 chars of key for display only
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Keep updated_at fresh
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_external_integrations_updated_at on public.external_integrations;
create trigger set_external_integrations_updated_at
before update on public.external_integrations
for each row execute function public.set_updated_at();

-- Indexes
create index if not exists external_integrations_service_idx on public.external_integrations (service);

-- RLS: only admins can read/write via authenticated clients. Service role bypasses RLS.
alter table public.external_integrations enable row level security;

-- Helper predicate to check admin role on profiles
-- Note: user_role enum and profiles.role are created in 0004_add_user_role.sql

drop policy if exists "external_integrations: admin select" on public.external_integrations;
create policy "external_integrations: admin select"
on public.external_integrations
as permissive
for select
to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
);

drop policy if exists "external_integrations: admin insert" on public.external_integrations;
create policy "external_integrations: admin insert"
on public.external_integrations
as permissive
for insert
to authenticated
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
);

drop policy if exists "external_integrations: admin update" on public.external_integrations;
create policy "external_integrations: admin update"
on public.external_integrations
as permissive
for update
to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
)
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
);

-- No deletes by default


