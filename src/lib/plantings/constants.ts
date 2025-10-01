import type { Enums } from '@/lib/supabase-server';

export type PlantingEventType = Enums<'planting_event_type'>;
export type PlantingStatus = Enums<'planting_status'>;

export const PLANTING_STATUS = {
  nursery: 'nursery',
  planted: 'planted',
  harvested: 'harvested',
  removed: 'removed',
} as const;

// Removed PROPAGATION_METHOD in favor of deriving from nursery_started_date
