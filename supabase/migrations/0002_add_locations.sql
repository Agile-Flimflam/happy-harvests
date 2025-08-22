-- Add locations table (UUID PK) and link plots to locations

-- Ensure pgcrypto is available for gen_random_uuid()
create extension if not exists "pgcrypto" with schema "public";

-- 1) New table: public.locations (UUID PK)
create table "public"."locations" (
  "id" uuid not null default gen_random_uuid(),
  "created_at" timestamp with time zone not null default now(),
  "name" text not null,
  "street" text,
  "city" text,
  "state" text,
  "zip" text,
  "latitude" double precision,
  "longitude" double precision,
  "notes" text,
  constraint "locations_latitude_check" check (
    latitude is null or (latitude >= -90 and latitude <= 90)
  ),
  constraint "locations_longitude_check" check (
    longitude is null or (longitude >= -180 and longitude <= 180)
  )
);

CREATE UNIQUE INDEX "Locations_pkey" ON public.locations USING btree (id);
alter table "public"."locations" add constraint "Locations_pkey" PRIMARY KEY using index "Locations_pkey";

-- 2) Link plots → locations (one location has many plots)
alter table "public"."plots" add column if not exists "location_id" uuid not null;

create index if not exists "Plots_location_id_idx" on public.plots using btree ("location_id");

alter table "public"."plots"
  add constraint "plots_location_id_fkey"
  foreign key ("location_id") references "public"."locations"("id") not valid;

alter table "public"."plots" validate constraint "plots_location_id_fkey";

-- 3) Grants (mirrors baseline style)
grant delete on table "public"."locations" to "anon";
grant insert on table "public"."locations" to "anon";
grant references on table "public"."locations" to "anon";
grant select on table "public"."locations" to "anon";
grant trigger on table "public"."locations" to "anon";
grant truncate on table "public"."locations" to "anon";
grant update on table "public"."locations" to "anon";

grant delete on table "public"."locations" to "authenticated";
grant insert on table "public"."locations" to "authenticated";
grant references on table "public"."locations" to "authenticated";
grant select on table "public"."locations" to "authenticated";
grant trigger on table "public"."locations" to "authenticated";
grant truncate on table "public"."locations" to "authenticated";
grant update on table "public"."locations" to "authenticated";

grant delete on table "public"."locations" to "service_role";
grant insert on table "public"."locations" to "service_role";
grant references on table "public"."locations" to "service_role";
grant select on table "public"."locations" to "service_role";
grant trigger on table "public"."locations" to "service_role";
grant truncate on table "public"."locations" to "service_role";
grant update on table "public"."locations" to "service_role";


