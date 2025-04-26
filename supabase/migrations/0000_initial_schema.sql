-- PLANTS
create table plants (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  variety        text,
  latin_name     text,
  is_organic     boolean default false,
  avg_days_to_maturity integer,
  created_at     timestamptz default now()
);

-- PLOTS
create table plots (
  id       uuid primary key default gen_random_uuid(),
  name     text not null,
  address  text,
  created_at timestamptz default now()
);

-- BEDS
create table beds (
  id        uuid primary key default gen_random_uuid(),
  plot_id   uuid references plots(id) on delete cascade not null, -- Added not null constraint
  name      text not null, -- Added bed name
  length_in integer,
  width_in  integer,
  created_at timestamptz default now()
);

-- CROPS
create type crop_status as enum ('planned','planted','growing','harvested');

create table crops (
  id            uuid primary key default gen_random_uuid(),
  plant_id      uuid references plants(id) on delete restrict not null, -- Added not null constraint
  bed_id        uuid references beds(id)   on delete restrict not null, -- Added not null constraint
  row_spacing_cm integer,
  seed_spacing_cm integer,
  planted_date  date,
  harvested_date date,
  status        crop_status default 'planned',
  created_at    timestamptz default now()
);

-- Add RLS policies (example for plants, repeat for others as needed)
-- Ensure RLS is enabled for each table in Supabase UI or via SQL
-- alter table plants enable row level security;
-- drop policy if exists "Allow authenticated read access" on plants;
-- create policy "Allow authenticated read access" on plants
--   for select using (auth.role() = 'authenticated');
-- drop policy if exists "Allow individual insert access" on plants;
-- create policy "Allow individual insert access" on plants
--   for insert with check (auth.role() = 'authenticated');
-- drop policy if exists "Allow individual update access" on plants;
-- create policy "Allow individual update access" on plants
--   for update using (auth.role() = 'authenticated');
-- drop policy if exists "Allow individual delete access" on plants;
-- create policy "Allow individual delete access" on plants
--   for delete using (auth.role() = 'authenticated');

-- Note: You'll need to enable RLS and define policies for plots, beds, and crops similarly.
-- Consider more specific policies based on user roles or ownership if needed later. 