begin;

    alter table public.beds
  add column
    if not exists name text null;

commit;


