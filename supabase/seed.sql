-- Insert Demo Data for Happy Harvests

-- Ensure RLS is disabled for seeding (or adjust policies temporarily)
-- alter table plots disable row level security;
-- alter table beds disable row level security;
-- alter table plants disable row level security;
-- alter table crops disable row level security;

do $$
declare
  demo_plot_id uuid;
  demo_bed_id uuid;
  demo_plant_id uuid;
begin
  -- 1. Insert a Demo Plot
  insert into public.plots (name, address)
  values ('Community Garden', '123 Green St, Growville')
  returning id into demo_plot_id;

  -- 2. Insert a Demo Bed associated with the Plot
  insert into public.beds (plot_id, name, length_in, width_in)
  values (demo_plot_id, 'Bed A1', 96, 48)
  returning id into demo_bed_id;

  -- 3. Insert a Demo Plant
  insert into public.plants (name, variety, latin_name, is_organic, avg_days_to_maturity)
  values ('Tomato', 'Roma', 'Solanum lycopersicum', true, 75)
  returning id into demo_plant_id;

  -- 4. Insert a Demo Crop linking the Plant and Bed
  insert into public.crops (plant_id, bed_id, status, planted_date)
  values (demo_plant_id, demo_bed_id, 'planted', current_date - interval '20 days');

end $$;

-- Re-enable RLS after seeding if it was disabled
-- alter table plots enable row level security;
-- alter table beds enable row level security;
-- alter table plants enable row level security;
-- alter table crops enable row level security; 