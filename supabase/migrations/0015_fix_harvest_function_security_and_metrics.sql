-- Fix harvest RPC: add security definer, validation, created_by, and end-date guard
begin;

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
    planting_id, event_type, event_date, qty_harvested, weight_grams, created_by
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
