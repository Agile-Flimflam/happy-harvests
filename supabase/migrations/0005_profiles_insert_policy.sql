-- Allow users to create their own profile row if missing

drop policy if exists "profiles: owner can insert" on public.profiles;
create policy "profiles: owner can insert"
  on public.profiles for insert to authenticated
  with check (auth.uid() = id);


