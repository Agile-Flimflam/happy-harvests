-- Purpose: Relax NOT NULL constraints to allow logging seed packets when the
-- exact variety is not yet known. This was split from 0025 on purpose:
--   1) 0025 introduced the table with stricter NOT NULLs to enforce integrity
--      at creation time.
--   2) During UI work we decided to support variety-less entries, so this
--      follow-up migration drops those constraints.
-- Keeping this as a separate migration avoids rewriting history if 0025 has
-- already been applied in shared environments. If you are bootstrapping a new
-- database, the net effect of 0025 + 0026 is that crop_variety_id and
-- variety_name are nullable, matching the current application behavior.
--
-- If you prefer a single-step definition for a fresh project, you can fold
-- these changes back into 0025 before the first deploy.
--
-- Allow logging seeds without specifying a variety
begin;

  alter table public.seeds
  alter column crop_variety_id drop not null;

  alter table public.seeds
  alter column variety_name drop not null;

  commit;


