-- Drop redundant propagation_method and update functions to no longer reference it
-- Also: remove qty_initial from plantings, move initial quantity to initial event quantity
-- Also: rename planting_events.qty_harvested -> planting_events.quantity and update harvest constraint/function

begin;

alter table public.plantings drop column if exists propagation_method;

-- Rename harvested quantity column to generic quantity
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'planting_events' and column_name = 'qty_harvested'
  ) then
    alter table public.planting_events rename column qty_harvested to quantity;
  end if;
end $$;

-- Ensure harvest requires at least one measure
alter table public.planting_events
  drop constraint if exists harvested_has_metrics;
alter table public.planting_events
  add constraint harvested_requires_measure check (
    event_type <> 'harvested'
    or (coalesce(quantity, 0) > 0 or coalesce(weight_grams, 0) > 0)
  );

-- Drop qty_initial from plantings (now recorded on initial event quantity)
alter table public.plantings drop column if exists qty_initial;

-- Update: Create nursery planting without propagation_method column
create or replace function public.fn_create_nursery_planting(
  p_crop_variety_id int,
  p_qty_initial int,
  p_nursery_id uuid,
  p_event_date date,
  p_notes text default null
) returns bigint
language plpgsql
security definer
as $$
declare v_planting_id bigint;
begin
  insert into public.plantings(
    crop_variety_id,
    status,
    nursery_started_date,
    planted_date,
    ended_date,
    bed_id,
    nursery_id,
    notes
  ) values (
    p_crop_variety_id,
    'nursery',
    p_event_date,
    null,
    null,
    null,
    p_nursery_id,
    p_notes
  ) returning id into v_planting_id;

  insert into public.planting_events(
    planting_id, event_type, event_date, nursery_id, quantity, created_by
  ) values (
    v_planting_id, 'nursery_seeded', p_event_date, p_nursery_id, p_qty_initial, public._current_user_id()
  );

  return v_planting_id;
end $$;

-- Update: Create direct-seeded planting without propagation_method column
create or replace function public.fn_create_direct_seed_planting(
  p_crop_variety_id int,
  p_qty_initial int,
  p_bed_id int,
  p_event_date date,
  p_notes text default null
) returns bigint
language plpgsql
security definer
as $$
declare v_planting_id bigint;
begin
  insert into public.plantings(
    crop_variety_id,
    status,
    nursery_started_date,
    planted_date,
    ended_date,
    bed_id,
    nursery_id,
    notes
  ) values (
    p_crop_variety_id,
    'planted',
    null,
    p_event_date,
    null,
    p_bed_id,
    null,
    p_notes
  ) returning id into v_planting_id;

  insert into public.planting_events(
    planting_id, event_type, event_date, bed_id, quantity, created_by
  ) values (
    v_planting_id, 'direct_seeded', p_event_date, p_bed_id, p_qty_initial, public._current_user_id()
  );

  return v_planting_id;
end $$;

-- Update harvest function to write to planting_events.quantity
create or replace function public.fn_harvest_planting(
  p_planting_id bigint,
  p_event_date date,
  p_qty_harvested int default null,
  p_weight_grams int default null
) returns void
language plpgsql
security definer
as $$
begin
  if coalesce(p_qty_harvested, 0) <= 0 and coalesce(p_weight_grams, 0) <= 0 then
    raise exception using
      message = 'At least one harvest metric (quantity or weight) is required.',
      hint    = 'Provide qty_harvested > 0 and/or weight_grams > 0.';
  end if;

  insert into public.planting_events (
    planting_id, event_type, event_date, quantity, weight_grams, created_by
  ) values (
    p_planting_id, 'harvested', p_event_date, p_qty_harvested, p_weight_grams, public._current_user_id()
  );

  update public.plantings
     set status = 'harvested',
         ended_date = p_event_date,
         updated_at = now()
   where id = p_planting_id
     and ended_date is null;
end;
$$;

grant execute on function public.fn_harvest_planting(bigint, date, int, int) to authenticated, service_role;

commit;
