-- Add image columns for crop varieties
alter table if exists public.crop_varieties
  add column if not exists image_path text null;
