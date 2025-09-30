import type { Enums } from '@/lib/supabase-server';

export type PlantingEventType = Enums<'planting_event_type'>;
export type PlantingStatus = Enums<'planting_status'>;

const PLANTING_EVENT_LABELS = {
  nursery_seeded: 'Nursery sown',
  direct_seeded: 'Direct seeded',
  transplanted: 'Transplanted',
  moved: 'Moved',
  harvested: 'Harvest',
  removed: 'Removed',
} as const satisfies Record<PlantingEventType, string>;

const PLANTING_STATUS_LABELS = {
  nursery: 'In Nursery',
  planted: 'Planted',
  harvested: 'Harvested',
  removed: 'Removed',
} as const satisfies Record<PlantingStatus, string>;

export function formatPlantingEventType(eventType: PlantingEventType): string {
  return PLANTING_EVENT_LABELS[eventType] ?? titleCase(String(eventType));
}

export function formatPlantingStatus(status: PlantingStatus): string {
  return PLANTING_STATUS_LABELS[status] ?? titleCase(String(status));
}

function titleCase(s: string): string {
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export type PlantingSummary = {
  nurseryStartedDate?: string | null;
  plantedDate?: string | null;
  endedDate?: string | null;
  nurseryDays: number;
  fieldDays: number;
  totalDays: number;
  currentLocationLabel?: string | null;
  movesCount: number;
  harvestQuantity?: { qty: number; unit?: string | null } | null;
  harvestWeightGrams?: number | null;
  propagationMethod?: 'Direct Seed' | 'Transplant' | string | null;
  initialQuantity?: number | null;
};

export function computePlantingSummary(args: {
  events: Array<{
    event_type: PlantingEventType | string;
    event_date: string;
    beds?: { id: number; plots?: { locations?: { name?: string | null } | null } | null } | null;
    nurseries?: { name?: string | null } | null;
    qty_harvested?: number | null;
    weight_grams?: number | null;
    quantity_unit?: string | null;
  }>;
  status?: PlantingStatus | string | null;
  propagationMethod?: 'Direct Seed' | 'Transplant' | string | null;
  initialQuantity?: number | null;
}): PlantingSummary {
  let nurseryStartedDate: string | null | undefined = undefined;
  let plantedDate: string | null | undefined = undefined;
  let endedDate: string | null | undefined = undefined;
  let currentLocationLabel: string | null | undefined = undefined;
  let movesCount = 0;
  let harvestQuantity: PlantingSummary['harvestQuantity'] = null;
  let harvestWeightGrams: number | null | undefined = undefined;

  for (const ev of args.events) {
    const type = ev.event_type as PlantingEventType;
    if (type === 'nursery_seeded' && nurseryStartedDate == null) {
      nurseryStartedDate = ev.event_date;
      currentLocationLabel = ev.nurseries?.name ?? 'Nursery';
    }
    if ((type === 'direct_seeded' || type === 'transplanted') && plantedDate == null) {
      plantedDate = ev.event_date;
    }
    if (type === 'direct_seeded' || type === 'transplanted' || type === 'moved') {
      const loc = ev.beds?.plots?.locations?.name ?? 'Unknown';
      const bed = ev.beds?.id != null ? `Bed #${ev.beds.id} @ ${loc}` : undefined;
      currentLocationLabel = bed ?? currentLocationLabel;
    }
    if (type === 'moved') movesCount += 1;
    if (type === 'harvested') {
      endedDate = ev.event_date;
      if (ev.qty_harvested != null) {
        harvestQuantity = { qty: ev.qty_harvested, unit: ev.quantity_unit ?? null };
      }
      if (ev.weight_grams != null) harvestWeightGrams = ev.weight_grams;
    }
    if (type === 'removed') {
      endedDate = ev.event_date;
    }
  }

  const today = new Date();
  const toDate = (s?: string | null) => (s ? new Date(s) : null);
  const dNurseryStart = toDate(nurseryStartedDate);
  const dPlanted = toDate(plantedDate);
  const dEnded = toDate(endedDate);

  const daysBetween = (a: Date, b: Date) => Math.max(0, Math.floor((a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24)));

  const nurseryDays = dNurseryStart ? daysBetween(dPlanted ?? today, dNurseryStart) : 0;
  const fieldDays = dPlanted ? daysBetween(dEnded ?? today, dPlanted) : 0;
  const totalDays = (() => {
    const start = dNurseryStart ?? dPlanted;
    return start ? daysBetween(dEnded ?? today, start) : 0;
  })();

  return {
    nurseryStartedDate: nurseryStartedDate ?? null,
    plantedDate: plantedDate ?? null,
    endedDate: endedDate ?? null,
    nurseryDays,
    fieldDays,
    totalDays,
    currentLocationLabel: currentLocationLabel ?? null,
    movesCount,
    harvestQuantity: harvestQuantity ?? null,
    harvestWeightGrams: harvestWeightGrams ?? null,
    propagationMethod: args.propagationMethod ?? null,
    initialQuantity: args.initialQuantity ?? null,
  };
}
