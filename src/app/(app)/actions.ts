'use server';

import { createSupabaseServerClient } from '@/lib/supabase-server';

type RawDashboardLocation = {
  id: string;
  latitude: number | null;
  longitude: number | null;
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
  const primary = (locationsRes.data as RawDashboardLocation[] | null | undefined)?.find(
    (loc): loc is DashboardLocation => loc.latitude != null && loc.longitude != null
  );

  return {
    cropVarietyCount: cropVarietyRes.count ?? null,
    plotCount: plotRes.count ?? null,
    plantingCount: plantingRes.count ?? null,
    primaryLocation: primary ?? null,
    error: errors.length ? `Database Error: ${errors[0]?.message ?? 'Unknown error'}` : undefined,
  };
}
