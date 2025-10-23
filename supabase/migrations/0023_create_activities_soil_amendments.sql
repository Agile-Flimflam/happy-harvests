begin;

    create table
    if not exists public.activities_soil_amendments
    (
  id bigserial primary key,
  activity_id bigint not null references public.activities
    (id) on
    delete cascade,
  name text
    not null,
  quantity numeric null,
  unit text null,
  notes text null,
  created_at timestamptz not null default now
    ()
);

    create index
    if not exists idx_asa_activity_id on public.activities_soil_amendments
    (activity_id);

    alter table
    if exists public.activities_soil_amendments enable row level security;

do $$
begin
    if not exists (
    select 1
    from pg_policies
    where tablename = 'activities_soil_amendments' and policyname = 'asa: authenticated all'
  ) then
    create policy "asa: authenticated all"
    on public.activities_soil_amendments
    for all to authenticated
    using
    (true)
    with check
    (true);
end
if;
end $$;

commit;





