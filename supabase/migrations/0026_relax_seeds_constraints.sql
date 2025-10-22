-- Allow logging seeds without specifying a variety
begin;

    alter table public.seeds
  alter column crop_variety_id drop not null;

    alter table public.seeds
  alter column variety_name drop not null;

    commit;


