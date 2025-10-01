-- Plantings lifecycle schema (event-sourced) with nursery + field phases
-- - Enums: planting_event_type, planting_status (lowercase snake_case)
-- - Tables: nurseries, plantings, planting_events
-- - Guardrails: partial-unique indexes for initial/terminal events; CHECK constraints
-- - Legacy: drops bed_plantings (breaking change) as requested

-- 1) Enums
create type planting_event_type as enum (
  'nursery_seeded', 'direct_seeded', 'transplanted', 'moved', 'harvested', 'removed'
);

create type planting_status as enum (
  'nursery', 'planted', 'harvested', 'removed'
);

-- 2) Nurseries
create table public.nurseries (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.locations(id),
  name text not null,
  notes text,
  created_at timestamptz not null default now()
);

-- 3) Plantings (current state + pointers)
create table public.plantings (
  id bigserial primary key,
  crop_variety_id int not null references public.crop_varieties(id),
  propagation_method text not null check (propagation_method in ('Direct Seed','Transplant')),
  qty_initial int not null check (qty_initial > 0),

  status planting_status not null,
  nursery_started_date date null,
  planted_date date null,
  ended_date date null,
  bed_id int null references public.beds(id),
  nursery_id uuid null references public.nurseries(id),

  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index plantings_status_idx on public.plantings(status);
create index plantings_bed_idx on public.plantings(bed_id);
create index plantings_nursery_idx on public.plantings(nursery_id);

-- 4) Events (append-only)
create table public.planting_events (
  id bigserial primary key,
  planting_id bigint not null references public.plantings(id) on delete cascade,
  event_type planting_event_type not null,
  event_date date not null,
  bed_id int null references public.beds(id),
  nursery_id uuid null references public.nurseries(id),

  qty_harvested int null check (qty_harvested is null or qty_harvested >= 0),
  weight_grams int null check (weight_grams is null or weight_grams >= 0),
  quantity_unit text null,

  payload jsonb null,
  created_by uuid null,
  created_at timestamptz not null default now(),

  constraint harvested_has_metrics check (
    event_type <> 'harvested' or (coalesce(qty_harvested, 0) > 0 or coalesce(weight_grams, 0) > 0)
  ),
  constraint removed_context check (
    event_type <> 'removed' or ((bed_id is null) <> (nursery_id is null))
  )
);

create index planting_events_pid_idx on public.planting_events(planting_id);
create index planting_events_type_date_idx on public.planting_events(event_type, event_date);

-- 5) Guardrails
create unique index one_initial_event_per_planting
  on public.planting_events(planting_id)
  where event_type in ('nursery_seeded','direct_seeded');

create unique index one_terminal_event_per_planting
  on public.planting_events(planting_id)
  where event_type in ('harvested','removed');

alter table public.plantings add constraint plantings_status_check
  check (status in ('nursery','planted','harvested','removed'));

alter table public.plantings add constraint plantings_bed_consistency
  check ((status = 'nursery' and bed_id is null) or (status in ('planted','harvested','removed') and bed_id is not null));

alter table public.plantings add constraint plantings_terminal_has_end
  check ((status in ('harvested','removed') and ended_date is not null) or (status in ('nursery','planted')));

alter table public.plantings add constraint plantings_planted_has_date
  check ((status = 'nursery' and planted_date is null) or (status in ('planted','harvested','removed') and planted_date is not null));

-- 6) Drop legacy table (breaking change)
drop table if exists public."bed_plantings" cascade;
