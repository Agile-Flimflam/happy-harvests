-- Drop unneeded name columns from seeds; names are inferred via crop_variety_id
begin;

    alter table public.seeds
    drop column if exists crop_name;

    alter table public.seeds
    drop column if exists variety_name;

    commit;


