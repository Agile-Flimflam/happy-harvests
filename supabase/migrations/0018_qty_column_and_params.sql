-- New migration: adjust RPC params to p_qty and ensure functions/constraints align
begin;

-- Ensure harvest constraint references qty
alter table public.planting_events
  drop constraint if exists harvested_requires_measure;
alter table public.planting_events
  add constraint harvested_requires_measure check (
    event_type <> 'harvested' or (coalesce(qty, 0) > 0 or coalesce(weight_grams, 0) > 0)
  );

-- Update harvest function to write to qty
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
    planting_id, event_type, event_date, qty, weight_grams, created_by
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

-- Update create functions to accept p_qty and insert into event.qty
create or replace function public.fn_create_nursery_planting(
  p_crop_variety_id int,
  p_qty int,
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
    planting_id, event_type, event_date, nursery_id, qty, created_by
  ) values (
    v_planting_id, 'nursery_seeded', p_event_date, p_nursery_id, p_qty, public._current_user_id()
  );

  return v_planting_id;
end $$;

create or replace function public.fn_create_direct_seed_planting(
  p_crop_variety_id int,
  p_qty int,
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
    planting_id, event_type, event_date, bed_id, qty, created_by
  ) values (
    v_planting_id, 'direct_seeded', p_event_date, p_bed_id, p_qty, public._current_user_id()
  );

  return v_planting_id;
end $$;

grant execute on function public.fn_harvest_planting(bigint, date, int, int) to authenticated, service_role;
grant execute on function public.fn_create_nursery_planting(int,int,uuid,date,text) to authenticated, service_role;
grant execute on function public.fn_create_direct_seed_planting(int,int,int,date,text) to authenticated, service_role;

commit;
