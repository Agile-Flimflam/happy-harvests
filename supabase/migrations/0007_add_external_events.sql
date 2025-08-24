-- Map internal resources to external calendar events

begin;

create table if not exists public.external_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('google_calendar')),
  resource_type text not null check (resource_type in ('planting')),
  resource_id bigint not null,
  calendar_id text not null,
  event_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, resource_type, resource_id)
);

create index if not exists external_events_lookup_idx on public.external_events(provider, resource_type, resource_id);

-- Keep updated_at current
create or replace function public.set_external_events_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_external_events_updated_at on public.external_events;
create trigger set_external_events_updated_at
before update on public.external_events
for each row execute function public.set_external_events_updated_at();

commit;


