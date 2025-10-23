-- Atomic lifecycle functions (no triggers). Each runs in a single transaction.

-- Helper: current user id (nullable outside auth context)
create or replace function public._current_user_id()
returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;

-- Create nursery planting
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
    crop_variety_id, propagation_method, qty_initial,
    status, nursery_started_date, planted_date, ended_date,
    bed_id, nursery_id, notes
  ) values (
    p_crop_variety_id, 'Transplant', p_qty_initial,
    'nursery', p_event_date, null, null,
    null, p_nursery_id, p_notes
  ) returning id into v_planting_id;

  insert into public.planting_events(
    planting_id, event_type, event_date, nursery_id, created_by
  ) values (
    v_planting_id, 'nursery_seeded', p_event_date, p_nursery_id, public._current_user_id()
  );

  return v_planting_id;
end $$;

-- Create direct-seeded planting
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
    crop_variety_id, propagation_method, qty_initial,
    status, nursery_started_date, planted_date, ended_date,
    bed_id, nursery_id, notes
  ) values (
    p_crop_variety_id, 'Direct Seed', p_qty_initial,
    'planted', null, p_event_date, null,
    p_bed_id, null, p_notes
  ) returning id into v_planting_id;

  insert into public.planting_events(
    planting_id, event_type, event_date, bed_id, created_by
  ) values (
    v_planting_id, 'direct_seeded', p_event_date, p_bed_id, public._current_user_id()
  );

  return v_planting_id;
end $$;

-- Transplant from nursery to bed
create or replace function public.fn_transplant_planting(
  p_planting_id bigint,
  p_bed_id int,
  p_event_date date
) returns void
language plpgsql
security definer
as $$
begin
  -- insert event
  insert into public.planting_events(planting_id, event_type, event_date, bed_id, created_by)
  values (p_planting_id, 'transplanted', p_event_date, p_bed_id, public._current_user_id());

  -- update state
  update public.plantings
  set status = 'planted',
      planted_date = coalesce(planted_date, p_event_date),
      bed_id = p_bed_id,
      nursery_id = null,
      updated_at = now()
  where id = p_planting_id and ended_date is null;
end $$;

-- Move between beds
create or replace function public.fn_move_planting(
  p_planting_id bigint,
  p_bed_id int,
  p_event_date date
) returns void
language plpgsql
security definer
as $$
begin
  insert into public.planting_events(planting_id, event_type, event_date, bed_id, created_by)
  values (p_planting_id, 'moved', p_event_date, p_bed_id, public._current_user_id());

  update public.plantings
  set bed_id = p_bed_id,
      updated_at = now()
  where id = p_planting_id and status = 'planted' and ended_date is null;
end $$;

-- Harvest terminal event
create or replace function public.fn_harvest_planting(
  p_planting_id bigint,
  p_event_date date,
  p_qty_harvested int default null,
  p_weight_grams int default null,
  p_quantity_unit text default null
) returns void
language plpgsql
security definer
as $$
begin
  if coalesce(p_qty_harvested, 0) <= 0 and coalesce(p_weight_grams, 0) <= 0 then
    raise exception 'harvest requires qty or weight';
  end if;

  insert into public.planting_events(
    planting_id, event_type, event_date, qty_harvested, weight_grams, quantity_unit, created_by
  ) values (
    p_planting_id, 'harvested', p_event_date, p_qty_harvested, p_weight_grams, p_quantity_unit, public._current_user_id()
  );

  update public.plantings
  set status = 'harvested',
      ended_date = p_event_date,
      updated_at = now()
  where id = p_planting_id and ended_date is null;
end $$;

-- Remove terminal event (nursery or field)
create or replace function public.fn_remove_planting(
  p_planting_id bigint,
  p_event_date date,
  p_reason text default null
) returns void
language plpgsql
security definer
as $$
declare v_planted_date date; v_bed_id int; v_nursery_id uuid;
begin
  select planted_date, bed_id, nursery_id into v_planted_date, v_bed_id, v_nursery_id
  from public.plantings where id = p_planting_id;

  if v_planted_date is null then
    -- remove in nursery: carry nursery_id
    insert into public.planting_events(planting_id, event_type, event_date, nursery_id, payload, created_by)
    values (p_planting_id, 'removed', p_event_date, v_nursery_id, case when p_reason is null then null else jsonb_build_object('reason', p_reason) end, public._current_user_id());
  else
    -- remove in field: carry bed_id
    insert into public.planting_events(planting_id, event_type, event_date, bed_id, payload, created_by)
    values (p_planting_id, 'removed', p_event_date, v_bed_id, case when p_reason is null then null else jsonb_build_object('reason', p_reason) end, public._current_user_id());
  end if;

  update public.plantings
  set status = 'removed',
      ended_date = p_event_date,
      updated_at = now()
  where id = p_planting_id and ended_date is null;
end $$;

-- Grants (adjust to your policy model)
grant execute on function public.fn_create_nursery_planting(int,int,uuid,date,text) to authenticated, service_role;
grant execute on function public.fn_create_direct_seed_planting(int,int,int,date,text) to authenticated, service_role;
grant execute on function public.fn_transplant_planting(bigint,int,date) to authenticated, service_role;
grant execute on function public.fn_move_planting(bigint,int,date) to authenticated, service_role;
grant execute on function public.fn_harvest_planting(bigint,date,int,int,text) to authenticated, service_role;
grant execute on function public.fn_remove_planting(bigint,date,text) to authenticated, service_role;
