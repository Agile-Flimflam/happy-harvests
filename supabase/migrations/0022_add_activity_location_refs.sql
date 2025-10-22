begin;

    alter table public.activities
  add column
    if not exists plot_id integer null references public.plots
    (plot_id) on
    delete
    set null
    ,
    add column
    if not exists bed_id integer null references public.beds
    (id) on
    delete
    set null
    ,
    add column
    if not exists nursery_id uuid null references public.nurseries
    (id) on
    delete
    set null;

    create index
    if not exists idx_activities_plot on public.activities
    (plot_id);
    create index
    if not exists idx_activities_bed on public.activities
    (bed_id);
    create index
    if not exists idx_activities_nursery on public.activities
    (nursery_id);

    commit;


