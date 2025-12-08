'use server';

import { createSupabaseServerClient } from '@/lib/supabase-server';

type RawDashboardLocation = {
  id: string;
  latitude: number | null;
  longitude: number | null;
};

const isNumberOrNull = (value: unknown): value is number | null =>
  value === null || typeof value === 'number';

const isRawDashboardLocation = (value: unknown): value is RawDashboardLocation => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    typeof record.id === 'string' &&
    isNumberOrNull(record.latitude) &&
    isNumberOrNull(record.longitude)
  );
};

const parseDashboardLocations = (data: unknown): RawDashboardLocation[] =>
  Array.isArray(data) ? data.filter(isRawDashboardLocation) : [];

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
  error?: string;
};

export async function getDashboardOverview(): Promise<DashboardOverview> {
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
  const rawLocations = parseDashboardLocations(locationsRes.data);
  const primary = rawLocations.find(
    (loc): loc is DashboardLocation =>
      typeof loc.latitude === 'number' &&
      Number.isFinite(loc.latitude) &&
      typeof loc.longitude === 'number' &&
      Number.isFinite(loc.longitude)
  );

  return {
    cropVarietyCount: cropVarietyRes.count ?? null,
    plotCount: plotRes.count ?? null,
    plantingCount: plantingRes.count ?? null,
    primaryLocation: primary ?? null,
    error: errors.length ? `Database Error: ${errors[0]?.message ?? 'Unknown error'}` : undefined,
  };
}
