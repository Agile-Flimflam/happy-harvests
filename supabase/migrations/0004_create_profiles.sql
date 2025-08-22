-- Create profiles table with RLS, triggers, and a public view for safe fields

create extension if not exists citext with schema public;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  full_name text,
  avatar_url text,
  locale text,
  timezone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Owner can read/update own profile
drop policy if exists "profiles: owner can select" on public.profiles;
create policy "profiles: owner can select"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "profiles: owner can update" on public.profiles;
create policy "profiles: owner can update"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Optional public view exposing only safe columns
drop view if exists public.public_profiles;
create view public.public_profiles
  with (security_barrier=true)
as
  select id, coalesce(display_name, full_name) as name, avatar_url
  from public.profiles;

grant select on public.public_profiles to anon, authenticated;

-- Keep updated_at current
drop function if exists public.set_updated_at cascade;
create function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

-- Seed a profile row when a new auth user is created
drop function if exists public.handle_new_user cascade;
create function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, display_name, avatar_url, locale)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', null),
    coalesce(new.raw_user_meta_data->>'display_name', new.raw_user_meta_data->>'full_name'),
    coalesce(new.raw_user_meta_data->>'avatar_url', null),
    coalesce(new.raw_user_meta_data->>'locale', null)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();


