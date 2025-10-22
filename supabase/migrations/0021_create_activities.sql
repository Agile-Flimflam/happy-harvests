-- Create activities table, enum, indexes, RLS, and policies

begin;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'activity_type') then
    create type public.activity_type as enum (
      'irrigation',
      'soil_amendment',
      'pest_management',
      'asset_maintenance'
    );
  end if;
end $$;

create table if not exists public.activities (
  id bigserial primary key,
  activity_type public.activity_type not null,
  started_at timestamptz not null,
  ended_at timestamptz null,
  duration_minutes integer null,
  labor_hours numeric null,
  location_id uuid null references public.locations(id) on delete set null,
  crop text null,
  asset_id text null,
  asset_name text null,
  quantity numeric null,
  unit text null,
  cost numeric null,
  notes text null,
  weather jsonb null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_activities_type_started on public.activities(activity_type, started_at desc);
create index if not exists idx_activities_location on public.activities(location_id);

-- updated_at trigger
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_activities_updated_at on public.activities;
create trigger trg_activities_updated_at
before update on public.activities
for each row
execute procedure public.set_updated_at();

-- RLS
alter table if exists public.activities enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where polname = 'activities: authenticated all' and tablename = 'activities'
  ) then
    create policy "activities: authenticated all"
    on public.activities
    for all
    to authenticated
    using (true)
    with check (true);
  end if;
end $$;

commit;


