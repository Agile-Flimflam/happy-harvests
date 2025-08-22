-- Add timezone column to locations
alter table "public"."locations"
  add column if not exists "timezone" text;