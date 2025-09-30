import type { Enums } from '@/lib/supabase-server';

export type PlantingEventType = Enums<'planting_event_type'>;
export type PlantingStatus = Enums<'planting_status'>;

export const PLANTING_STATUS = {
  nursery: 'nursery',
  planted: 'planted',
  harvested: 'harvested',
  removed: 'removed',
} as const;

export const PROPAGATION_METHOD = {
  directSeed: 'Direct Seed',
  transplant: 'Transplant',
} as const;

export type PropagationMethod = typeof PROPAGATION_METHOD[keyof typeof PROPAGATION_METHOD];
