begin;

create table if not exists public.customers (
  id uuid not null default gen_random_uuid() primary key,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  name text not null,
  email text,
  phone text,
  fax text,
  website text,
  billing_street text,
  billing_city text,
  billing_state text,
  billing_zip text,
  shipping_street text,
  shipping_city text,
  shipping_state text,
  shipping_zip text,
  notes text
);

alter table public.customers enable row level security;
create policy "customers: authenticated all" on public.customers for all to authenticated using (true) with check (true);

-- trigger to update updated_at
create or replace function public.set_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end; $$;

drop trigger if exists set_customers_updated_at on public.customers;
create trigger set_customers_updated_at before update on public.customers for each row execute function public.set_updated_at();

commit;


