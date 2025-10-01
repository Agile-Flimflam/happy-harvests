-- Add weight support to initial create functions
begin;

-- Drop all versions of these functions by name to avoid parameter name conflicts
drop function if exists public.fn_create_nursery_planting;
drop function if exists public.fn_create_direct_seed_planting;

-- Nursery: p_qty and optional p_weight_grams
create function public.fn_create_nursery_planting(
  p_crop_variety_id int,
  p_qty int,
  p_nursery_id uuid,
  p_event_date date,
  p_notes text default null,
  p_weight_grams int default null
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
    planting_id, event_type, event_date, nursery_id, qty, weight_grams, created_by
  ) values (
    v_planting_id, 'nursery_seeded', p_event_date, p_nursery_id, p_qty, p_weight_grams, public._current_user_id()
  );

  return v_planting_id;
end $$;

-- Direct seed: p_qty and optional p_weight_grams
create function public.fn_create_direct_seed_planting(
  p_crop_variety_id int,
  p_qty int,
  p_bed_id int,
  p_event_date date,
  p_notes text default null,
  p_weight_grams int default null
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
    planting_id, event_type, event_date, bed_id, qty, weight_grams, created_by
  ) values (
    v_planting_id, 'direct_seeded', p_event_date, p_bed_id, p_qty, p_weight_grams, public._current_user_id()
  );

  return v_planting_id;
end $$;

grant execute on function public.fn_create_nursery_planting(int,int,uuid,date,text,int) to authenticated, service_role;
grant execute on function public.fn_create_direct_seed_planting(int,int,int,date,text,int) to authenticated, service_role;

commit;
