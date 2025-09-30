-- Enable RLS across domain tables and add policies
-- - Domain tables (locations, plots, beds, bed_plantings, crops, crop_varieties):
--   authenticated users can read/write
-- - Sensitive tables (external_events): admin-only read/write

begin;

-- Enable RLS on domain tables (no-op if already enabled)
alter table if exists public.locations enable row level security;
alter table if exists public.plots enable row level security;
alter table if exists public.beds enable row level security;
alter table if exists public.bed_plantings enable row level security;
alter table if exists public.crops enable row level security;
alter table if exists public.crop_varieties enable row level security;
alter table if exists public.external_events enable row level security;
alter table if exists public.external_integrations enable row level security;

-- =====================
-- locations
-- =====================

create policy "locations: authenticated all"
on public.locations
for all
to authenticated
using (true)
with check (true);

-- =====================
-- plots
-- =====================
create policy "plots: authenticated all"
on public.plots
for all
to authenticated
using (true)
with check (true);

-- =====================
-- beds
-- =====================
create policy "beds: authenticated all"
on public.beds
for all
to authenticated
using (true)
with check (true);

-- =====================
-- bed_plantings
-- =====================
create policy "bed_plantings: authenticated all"
on public.bed_plantings
for all
to authenticated
using (true)
with check (true);

-- =====================
-- crops
-- =====================
create policy "crops: authenticated all"
on public.crops
for all
to authenticated
using (true)
with check (true);

-- =====================
-- crop_varieties
-- =====================
create policy "crop_varieties: authenticated all"
on public.crop_varieties
for all
to authenticated
using (true)
with check (true);

-- =====================
-- external_events (admin-only policies)
-- =====================
create policy "external_events: admin all"
on public.external_events
for all
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

-- =====================
-- external_integrations (admin-only policies)
-- Existing policies created in 0005; replace with a single FOR ALL
-- =====================
drop policy if exists "external_integrations: admin select" on public.external_integrations;
drop policy if exists "external_integrations: admin insert" on public.external_integrations;
drop policy if exists "external_integrations: admin update" on public.external_integrations;
drop policy if exists "external_integrations: admin delete" on public.external_integrations;

create policy "external_integrations: admin all"
on public.external_integrations
for all
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

commit;
