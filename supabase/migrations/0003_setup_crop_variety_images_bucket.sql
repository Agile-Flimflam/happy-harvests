-- Create a public crop_variety_images bucket (idempotent)
insert into storage.buckets (id, name, public)
values ('crop_variety_images', 'crop_variety_images', true)
on conflict (id) do nothing;

-- Allow public read for crop_variety_images bucket
drop policy if exists "Public read crop variety images" on storage.objects;
create policy "Public read crop variety images" on storage.objects
for select
using (bucket_id = 'crop_variety_images');

-- Allow authenticated users to upload files to crop_variety_images bucket
drop policy if exists "Authenticated users can upload crop variety images" on storage.objects;
create policy "Authenticated users can upload crop variety images" on storage.objects
for insert to authenticated
with check (
  bucket_id = 'crop_variety_images'
);

-- Allow authenticated users to update files in crop_variety_images bucket
drop policy if exists "Authenticated users can update crop variety images" on storage.objects;
create policy "Authenticated users can update crop variety images" on storage.objects
for update to authenticated
using (
  bucket_id = 'crop_variety_images'
)
with check (
  bucket_id = 'crop_variety_images'
);

-- Allow authenticated users to delete files in crop_variety_images bucket
drop policy if exists "Authenticated users can delete crop variety images" on storage.objects;
create policy "Authenticated users can delete crop variety images" on storage.objects
for delete to authenticated
using (
  bucket_id = 'crop_variety_images'
);
