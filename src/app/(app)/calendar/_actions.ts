'use server';

import { createSupabaseServerClient } from '@/lib/supabase-server';
import {
  asActionError,
  asActionSuccess,
  createCorrelationId,
  type ActionResult,
} from '@/lib/action-result';
import type { Enums } from '@/lib/database.types';
import type { CalendarEvent, CalendarLocation } from './types';
import { normalizeMinMax } from '@/lib/plantings/utils';
import { normalizeDtm } from '@/lib/dtm';
import { addDaysUtc } from '@/lib/date';

export async function getCalendarEvents(): Promise<ActionResult<{ events: CalendarEvent[] }>> {
  const correlationId = createCorrelationId();
  try {
    const supabase = await createSupabaseServerClient();
    const events: CalendarEvent[] = [];
    // Activities (historical + future)
    type ActivityRow = {
      id: number;
      activity_type: Enums<'activity_type'>;
      started_at: string;
      ended_at: string | null;
      duration_minutes: number | null;
      location_id: string | null;
      crop: string | null;
      asset_name: string | null;
      notes: string | null;
      activities_soil_amendments?: Array<{
        name: string;
        quantity: number | null;
        unit: string | null;
      }>;
    };
    const { data: acts, error: actsError } = await supabase
      .from('activities')
      .select(
        'id, activity_type, started_at, ended_at, duration_minutes, location_id, crop, asset_name, notes, activities_soil_amendments(name,quantity,unit)'
      )
      .order('started_at', { ascending: true });
    if (actsError) {
      return asActionError({
        code: 'server',
        message: actsError.message ?? 'Failed to load activities for calendar.',
        correlationId,
      });
    }
    for (const a of (acts as ActivityRow[]) || []) {
      events.push({
        id: `a:${a.id}`,
        type: 'activity',
        title:
          `${a.activity_type.replace('_', ' ')}` +
          (a.crop ? ` · ${a.crop}` : '') +
          (a.asset_name ? ` · ${a.asset_name}` : ''),
        start: a.started_at,
        end: a.ended_at,
        meta: a as unknown as Record<string, unknown>,
      });
    }
    // Plantings: derive from planting_events for seeded dates, include quantities
    type PlantingSeedRow = {
      id: number;
      event_date: string;
      event_type: string;
      qty: number | null;
      weight_grams: number | null;
      planting_id: number;
      bed_id: number | null;
      plantings: {
        status: string | null;
        crop_varieties: {
          name: string | null;
          crops: { name: string | null } | null;
          dtm_direct_seed_min: number;
          dtm_direct_seed_max: number;
          dtm_transplant_min: number;
          dtm_transplant_max: number;
        } | null;
        beds: {
          id: number;
          plots: { name: string | null; locations: { name: string | null } | null } | null;
        } | null;
      } | null;
    };
    const { data: pes, error: pesError } = await supabase
      .from('planting_events')
      .select(
        'id, event_date, event_type, qty, weight_grams, planting_id, bed_id, plantings(status, crop_varieties(name, crops(name), dtm_direct_seed_min, dtm_direct_seed_max, dtm_transplant_min, dtm_transplant_max), beds(id, plots(name, locations(name))))'
      )
      .in('event_type', ['nursery_seeded', 'direct_seeded', 'transplanted'])
      .order('event_date', { ascending: true });
    if (pesError) {
      return asActionError({
        code: 'server',
        message: pesError.message ?? 'Failed to load planting events for calendar.',
        correlationId,
      });
    }
    const pushedHarvestForId = new Set<number>();
    const addDays = addDaysUtc;
    // Use UTC for today's date to match UTC-based addDays output (YYYY-MM-DD)
    function todayUtcISO() {
      return new Date().toISOString().slice(0, 10);
    }
    const todayISO1 = todayUtcISO();

    // Shared helper: compute a predicted harvest window from a base date and DTM values
    /**
     * Computes an estimated harvest window based on a base date and days-to-maturity (DTM) inputs.
     *
     * @param args.baseDate - ISO date (YYYY-MM-DD) used as the starting point for DTM calculations; null to skip.
     * @param args.isTransplantBase - If true, use transplant DTM values; otherwise use direct-seed DTM values.
     * @param args.dsMin - Direct-seed minimum DTM (days) to first harvest; may be 0/undefined if not applicable.
     * @param args.dsMax - Direct-seed maximum DTM (days) to last harvest; may be 0/undefined if not applicable.
     * @param args.tpMin - Transplant minimum DTM (days) to first harvest; may be 0/undefined if not applicable.
     * @param args.tpMax - Transplant maximum DTM (days) to last harvest; may be 0/undefined if not applicable.
     * @param args.todayISO - Today’s date (YYYY-MM-DD) in UTC for filtering out fully past windows.
     * @returns A window with inclusive start and end ISO dates, or null if insufficient data.
     */
    function harvestWindowFromBase(args: {
      baseDate: string | null;
      isTransplantBase: boolean;
      dsMin: number;
      dsMax: number;
      tpMin: number;
      tpMax: number;
      todayISO: string;
    }): { start: string; end: string } | null {
      const { baseDate, isTransplantBase, dsMin, dsMax, tpMin, tpMax, todayISO } = args;
      if (!baseDate) return null;
      const tp = normalizeMinMax(tpMin ?? null, tpMax ?? null);
      const ds = normalizeMinMax(dsMin ?? null, dsMax ?? null);
      const minDays = isTransplantBase ? tp.min : ds.min;
      const maxDays = isTransplantBase ? tp.max : ds.max;
      if (minDays <= 0) return null;
      const start = addDays(baseDate, minDays);
      const end = addDays(baseDate, maxDays);
      if (end < todayISO) return null;
      return { start, end };
    }
    for (const pe of (pes as PlantingSeedRow[]) || []) {
      const locName = pe.plantings?.beds?.plots?.locations?.name ?? null;
      const plotName = pe.plantings?.beds?.plots?.name ?? null;
      const bedId = pe.plantings?.beds?.id ?? null;
      const locationLabel =
        bedId != null
          ? `Bed #${bedId}` + (plotName ? ` @ ${plotName}` : locName ? ` @ ${locName}` : '')
          : null;
      // Use planting_event id to keep keys unique when multiple events exist per planting
      events.push({
        id: `p:${pe.id}`,
        type: 'planting',
        title: `Planting · ${pe.plantings?.status ?? ''}`,
        start: pe.event_date,
        meta: {
          status: pe.plantings?.status ?? undefined,
          crop: pe.plantings?.crop_varieties?.crops?.name ?? undefined,
          variety: pe.plantings?.crop_varieties?.name ?? undefined,
          qty: pe.qty ?? undefined,
          weight_grams: pe.weight_grams ?? undefined,
          planting_id: pe.planting_id,
          location_label: locationLabel ?? undefined,
        },
      });
      // Predict harvest window from this event (avoid duplicates per planting)
      if (!pushedHarvestForId.has(pe.planting_id) && pe.plantings?.status !== 'harvested') {
        const cv = pe.plantings?.crop_varieties;
        const crop = cv?.crops?.name ?? undefined;
        const variety = cv?.name ?? undefined;
        const { dsMin, dsMax, tpMin, tpMax } = normalizeDtm(
          cv?.dtm_direct_seed_min,
          cv?.dtm_direct_seed_max,
          cv?.dtm_transplant_min,
          cv?.dtm_transplant_max
        );
        const win = harvestWindowFromBase({
          baseDate: pe.event_date,
          isTransplantBase: pe.event_type === 'transplanted',
          dsMin,
          dsMax,
          tpMin,
          tpMax,
          todayISO: todayISO1,
        });
        if (win) {
          events.push({
            id: `h:${pe.planting_id}`,
            type: 'harvest',
            title: (['Harvest', crop].filter(Boolean) as string[]).join(' · '),
            start: win.start,
            end: win.end,
            meta: {
              planting_id: pe.planting_id,
              crop,
              variety,
              status: pe.plantings?.status ?? undefined,
              source: 'predicted',
              window_start: win.start,
              window_end: win.end,
              location_label: locationLabel ?? undefined,
            },
          });
          pushedHarvestForId.add(pe.planting_id);
        }
      }
    }
    // Harvests: predict future harvest dates only (no past dates, no already-harvested plantings)

    // Load minimal event timeline for each planting
    type EventRow = { planting_id: number; event_type: string; event_date: string };
    const { data: eventRows, error: eventRowsError } = await supabase
      .from('planting_events')
      .select('planting_id, event_type, event_date')
      .in('event_type', ['direct_seeded', 'nursery_seeded', 'transplanted', 'harvested']);
    if (eventRowsError) {
      return asActionError({
        code: 'server',
        message: eventRowsError.message ?? 'Failed to load planting event timeline for calendar.',
        correlationId,
      });
    }

    type PerPlantingEvents = {
      direct_seeded?: string;
      nursery_seeded?: string;
      transplanted?: string;
      harvested?: string;
    };
    function isPerPlantingEventKey(k: string): k is keyof PerPlantingEvents {
      return (
        k === 'direct_seeded' || k === 'nursery_seeded' || k === 'transplanted' || k === 'harvested'
      );
    }
    const perPlanting = new Map<number, PerPlantingEvents>();
    for (const er of (eventRows as EventRow[]) || []) {
      const rec = perPlanting.get(er.planting_id) ?? {};
      const rawKey = er.event_type;
      if (!isPerPlantingEventKey(rawKey)) {
        // Skip unknown event types defensively, even though .in() filters them
        perPlanting.set(er.planting_id, rec);
        continue;
      }
      const prev = rec[rawKey];
      if (!prev || er.event_date < prev) rec[rawKey] = er.event_date;
      perPlanting.set(er.planting_id, rec);
    }

    type PlantingRow = {
      id: number;
      status: string | null;
      nursery_started_date: string | null;
      planted_date: string | null;
      crop_varieties: {
        name: string | null;
        crops: { name: string | null } | null;
        dtm_direct_seed_min: number;
        dtm_direct_seed_max: number;
        dtm_transplant_min: number;
        dtm_transplant_max: number;
      } | null;
      beds: {
        id: number;
        plots: { name: string | null; locations: { name: string | null } | null } | null;
      } | null;
    };
    const { data: plantings, error: plantingsError } = await supabase
      .from('plantings')
      .select(
        'id, status, nursery_started_date, planted_date, crop_varieties:crop_variety_id(name, crops(name), dtm_direct_seed_min, dtm_direct_seed_max, dtm_transplant_min, dtm_transplant_max), beds:bed_id(id, plots(name, locations(name)))'
      );
    if (plantingsError) {
      return asActionError({
        code: 'server',
        message: plantingsError.message ?? 'Failed to load plantings for calendar.',
        correlationId,
      });
    }

    for (const p of (plantings as PlantingRow[]) || []) {
      const crop = p.crop_varieties?.crops?.name ?? undefined;
      const variety = p.crop_varieties?.name ?? undefined;
      const locName = p.beds?.plots?.locations?.name ?? null;
      const plotName = p.beds?.plots?.name ?? null;
      const bedId = p.beds?.id ?? null;
      const locationLabel =
        bedId != null
          ? `Bed #${bedId}` + (plotName ? ` @ ${plotName}` : locName ? ` @ ${locName}` : '')
          : null;
      const { dsMin, dsMax, tpMin, tpMax } = normalizeDtm(
        p.crop_varieties?.dtm_direct_seed_min,
        p.crop_varieties?.dtm_direct_seed_max,
        p.crop_varieties?.dtm_transplant_min,
        p.crop_varieties?.dtm_transplant_max
      );
      const evs = perPlanting.get(p.id) || {};

      // Skip if harvested already (by status or event)
      if (p.status === 'harvested' || evs.harvested) continue;

      // Determine base date and DTM:
      // - If transplanted: base = transplanted date, dtm = transplant min
      // - Else if nursery sowed (and not transplanted): base = nursery date, dtm = direct-seed min
      // - Else if direct seeded: base = direct-seed date, dtm = direct-seed min
      // - Fallback to columns if events missing
      let baseDate: string | null = null;
      let isTransplantBase = false;
      if (evs.transplanted) {
        baseDate = evs.transplanted;
        isTransplantBase = true;
      } else if (evs.nursery_seeded) {
        baseDate = evs.nursery_seeded;
        isTransplantBase = false;
      } else if (evs.direct_seeded) {
        baseDate = evs.direct_seeded;
        isTransplantBase = false;
      } else if (p.planted_date) {
        baseDate = p.planted_date;
        isTransplantBase = false;
      } else if (p.nursery_started_date) {
        baseDate = p.nursery_started_date;
        isTransplantBase = false;
      }

      const win2 = harvestWindowFromBase({
        baseDate,
        isTransplantBase,
        dsMin,
        dsMax,
        tpMin,
        tpMax,
        todayISO: todayISO1,
      });
      if (!win2) continue;

      if (!pushedHarvestForId.has(p.id)) {
        events.push({
          id: `h:${p.id}`,
          type: 'harvest',
          title: (['Harvest', crop].filter(Boolean) as string[]).join(' · '),
          start: win2.start,
          end: win2.end,
          meta: {
            planting_id: p.id,
            crop,
            variety,
            status: p.status ?? undefined,
            source: 'predicted',
            window_start: win2.start,
            window_end: win2.end,
            location_label: locationLabel ?? undefined,
          },
        });
      }
    }
    return asActionSuccess({ events }, undefined, correlationId);
  } catch (error) {
    console.error('[Calendar] Failed to load calendar events', error);
    return asActionError({
      code: 'server',
      message: 'Failed to load calendar events.',
      correlationId,
    });
  }
}

export async function getCalendarLocations(): Promise<
  ActionResult<{ locations: Array<CalendarLocation> }>
> {
  const correlationId = createCorrelationId();
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from('locations')
      .select('id, name, latitude, longitude')
      .order('created_at', { ascending: true })
      .limit(10);
    if (error) {
      return asActionError({
        code: 'server',
        message: error.message ?? 'Failed to load calendar locations.',
        correlationId,
      });
    }
    return asActionSuccess(
      { locations: (data as Array<CalendarLocation>) || [] },
      undefined,
      correlationId
    );
  } catch (error) {
    console.error('[Calendar] Failed to load calendar locations', error);
    return asActionError({
      code: 'server',
      message: 'Failed to load calendar locations.',
      correlationId,
    });
  }
}
