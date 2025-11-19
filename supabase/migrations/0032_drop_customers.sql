begin;

-- Drop trigger
drop trigger if exists set_customers_updated_at on public.customers;

-- Drop policy
drop policy if exists "customers: authenticated all" on public.customers;

-- Drop table
drop table if exists public.customers;

commit;

