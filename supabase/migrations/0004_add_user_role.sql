-- Add user_role enum and role column to profiles
do $$ begin
  create type public.user_role as enum ('admin', 'member');
exception when duplicate_object then null; end $$;

alter table public.profiles
  add column if not exists role public.user_role not null default 'member';


