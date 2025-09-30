-- Remove quantity_unit from planting_events and update harvest RPC
begin;

-- Drop column if exists
alter table planting_events drop column if exists quantity_unit;

-- Replace harvest function without quantity_unit parameter
drop function if exists public.fn_harvest_planting(bigint, date, int, int, text);

create or replace function public.fn_harvest_planting(
  p_planting_id bigint,
  p_event_date date,
  p_qty_harvested int default null,
  p_weight_grams int default null
) returns void
language plpgsql
as $$
begin
  -- Insert harvested event
  insert into planting_events (
    planting_id, event_type, event_date, qty_harvested, weight_grams
  ) values (
    p_planting_id, 'harvested', p_event_date, p_qty_harvested, p_weight_grams
  );

  -- Update plantings status and end date
  update plantings
     set status = 'harvested',
         ended_date = p_event_date,
         updated_at = now()
   where id = p_planting_id;
end;
$$;

grant execute on function public.fn_harvest_planting(bigint, date, int, int) to authenticated, service_role;

commit;
