-- Enable RLS and add policies for nurseries, plantings, planting_events

begin;

alter table if exists public.nurseries enable row level security;
alter table if exists public.plantings enable row level security;
alter table if exists public.planting_events enable row level security;

-- Simple model consistent with existing: authenticated can read/write
create policy "nurseries: authenticated all"
on public.nurseries
for all
to authenticated
using (true)
with check (true);

create policy "plantings: authenticated all"
on public.plantings
for all
to authenticated
using (true)
with check (true);

create policy "planting_events: authenticated all"
on public.planting_events
for all
to authenticated
using (true)
with check (true);

commit;
