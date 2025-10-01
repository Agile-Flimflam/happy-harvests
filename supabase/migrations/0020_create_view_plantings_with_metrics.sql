-- View exposing planted and harvest metrics per planting
begin;

create or replace view public.plantings_summary as
select
  p.id,
  -- planted metrics: first initial event
  (
    select pe.qty
    from public.planting_events pe
    where pe.planting_id = p.id
      and pe.event_type in ('nursery_seeded','direct_seeded')
    order by pe.event_date asc, pe.created_at asc, pe.id asc
    limit 1
  ) as planted_qty,
  (
    select pe.weight_grams
    from public.planting_events pe
    where pe.planting_id = p.id
      and pe.event_type in ('nursery_seeded','direct_seeded')
    order by pe.event_date asc, pe.created_at asc, pe.id asc
    limit 1
  ) as planted_weight_grams,
  -- harvest metrics: terminal harvest event
  (
    select pe.qty
    from public.planting_events pe
    where pe.planting_id = p.id
      and pe.event_type = 'harvested'
    order by pe.event_date desc, pe.created_at desc, pe.id desc
    limit 1
  ) as harvest_qty,
  (
    select pe.weight_grams
    from public.planting_events pe
    where pe.planting_id = p.id
      and pe.event_type = 'harvested'
    order by pe.event_date desc, pe.created_at desc, pe.id desc
    limit 1
  ) as harvest_weight_grams
from public.plantings p;

comment on view public.plantings_summary is 'Per-planting metrics: planted and harvest quantities/weights';

commit;
