'use server';

import { createSupabaseServerClient } from '@/lib/supabase-server';
import type { ActionResult } from '@/lib/action-result';

type RawDashboardLocation = {
  id: string;
  latitude: number | null;
  longitude: number | null;
};

const isLatitude = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= -90 && value <= 90;

const isLongitude = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= -180 && value <= 180;

const isRawDashboardLocation = (value: unknown): value is RawDashboardLocation => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    typeof record.id === 'string' &&
    (record.latitude === null || isLatitude(record.latitude)) &&
    (record.longitude === null || isLongitude(record.longitude))
  );
};

const parseDashboardLocations = (data: unknown): RawDashboardLocation[] => {
  if (!Array.isArray(data)) return [];
  const valid = data.filter(isRawDashboardLocation);
  if (valid.length !== data.length) {
    console.warn('[Dashboard] Filtered malformed location rows', {
      received: data.length,
      valid: valid.length,
    });
  }
  return valid;
};

export type DashboardLocation = {
  id: string;
  latitude: number;
  longitude: number;
};

export type DashboardOverview = {
  cropVarietyCount: number | null;
  plotCount: number | null;
  plantingCount: number | null;
  primaryLocation: DashboardLocation | null;
  cropVarietyError?: string;
  plotError?: string;
  plantingError?: string;
  error?: string;
};

function redactDbError(context: string, err: unknown): string {
  console.error(`[Dashboard] ${context}`, err);
  return 'Unable to load data right now.';
}

export type DashboardOverviewResult = ActionResult<DashboardOverview>;

export async function getDashboardOverview(): Promise<DashboardOverviewResult> {
  const supabase = await createSupabaseServerClient();

  const [cropVarietyRes, plotRes, plantingRes, locationsRes] = await Promise.all([
    supabase.from('crop_varieties').select('*', { count: 'exact', head: true }),
    supabase.from('plots').select('*', { count: 'exact', head: true }),
    supabase.from('plantings').select('*', { count: 'exact', head: true }),
    supabase
      .from('locations')
      .select('id, latitude, longitude')
      .order('created_at', { ascending: true })
      .limit(10),
  ]);

  const errors = [
    cropVarietyRes.error,
    plotRes.error,
    plantingRes.error,
    locationsRes.error,
  ].filter(Boolean);
  const cropVarietyError = cropVarietyRes.error
    ? redactDbError('Error loading crop varieties', cropVarietyRes.error)
    : undefined;
  const plotError = plotRes.error ? redactDbError('Error loading plots', plotRes.error) : undefined;
  const plantingError = plantingRes.error
    ? redactDbError('Error loading plantings', plantingRes.error)
    : undefined;
  const rawLocations = parseDashboardLocations(locationsRes.data);
  const primary = rawLocations.find(
    (loc): loc is DashboardLocation => isLatitude(loc.latitude) && isLongitude(loc.longitude)
  );

  const overview: DashboardOverview = {
    cropVarietyCount: cropVarietyRes.count ?? null,
    plotCount: plotRes.count ?? null,
    plantingCount: plantingRes.count ?? null,
    primaryLocation: primary ?? null,
    cropVarietyError,
    plotError,
    plantingError,
    error: errors.length ? 'Unable to load dashboard data.' : undefined,
  };

  if (errors.length) {
    return {
      ok: false,
      code: 'server',
      message: overview.error ?? 'Unable to load dashboard data.',
    };
  }

  return { ok: true, data: overview };
}
