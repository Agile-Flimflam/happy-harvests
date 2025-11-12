begin;

    -- Drop trigger
    drop trigger if exists set_deliveries_updated_at
    on public.deliveries;

-- Drop policies for delivery_item_images
drop policy
if exists "Allow authenticated user to view own delivery item images" on public.delivery_item_images;
drop policy
if exists "Allow authenticated user to insert delivery item images" on public.delivery_item_images;
drop policy
if exists "Allow authenticated user to delete own delivery item images" on public.delivery_item_images;

-- Drop policies for deliveries and delivery_items
drop policy
if exists "deliveries: authenticated all" on public.deliveries;
drop policy
if exists "delivery_items: authenticated all" on public.delivery_items;

-- Drop tables (delivery_item_images first, then delivery_items, then deliveries)
drop table if exists public.delivery_item_images;
drop table if exists public.delivery_items;
drop table if exists public.deliveries;

commit;