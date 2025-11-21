'use server';

import { revalidatePath } from 'next/cache';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import type { ActivityType } from '@/lib/activities/types';
import { fetchWeatherByCoords } from '@/lib/openweather.server';
import type { Json, Tables, Database } from '@/lib/database.types';
import { ActivitySchema, type ActivityFormValues } from '@/lib/validation/activities';
import type { SupabaseClient } from '@supabase/supabase-js';

export type ActivityFormState = {
  message: string;
  errors?: Record<string, string[] | undefined>;
};

type ErrorLike = {
  message?: string;
  details?: string;
  hint?: string;
  code?: string;
  status?: string;
  error_description?: string;
  error?: string;
} & Record<string, unknown>;

function errorToMessage(err: unknown): string {
  try {
    const e = err as ErrorLike;
    const parts = [
      e?.message,
      e?.details,
      e?.hint,
      e?.code,
      e?.status,
      e?.error_description,
      e?.error,
    ].filter((v) => typeof v === 'string' && v.trim().length > 0);
    if (parts.length > 0) return parts.join(' | ');
    try {
      return JSON.stringify(e);
    } catch {
      return JSON.stringify(e, Object.getOwnPropertyNames(e));
    }
  } catch {
    return 'Unknown error';
  }
}

function parseAmendmentsJson(raw: FormDataEntryValue | null) {
  if (typeof raw !== 'string') return null;

  try {
    const str = raw.trim();
    if (!str) return null;
    const parsed = JSON.parse(str);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function getString(data: FormDataEntryValue | null): string {
  return typeof data === 'string' ? data : '';
}

function extractActivityFormData(formData: FormData) {
  return {
    activity_type: formData.get('activity_type'),
    started_at: getString(formData.get('started_at')),
    ended_at: getString(formData.get('ended_at')) || null,
    duration_minutes: formData.get('duration_minutes') || null,
    labor_hours: formData.get('labor_hours') || null,
    location_id: getString(formData.get('location_id')) || null,
    plot_id: formData.get('plot_id') || null,
    bed_id: formData.get('bed_id') || null,
    nursery_id: formData.get('nursery_id') || null,
    crop: getString(formData.get('crop')) || null,
    asset_id: getString(formData.get('asset_id')) || null,
    asset_name: getString(formData.get('asset_name')) || null,
    quantity: formData.get('quantity') || null,
    unit: getString(formData.get('unit')) || null,
    cost: formData.get('cost') || null,
    notes: getString(formData.get('notes')) || null,
    amendments: parseAmendmentsJson(formData.get('amendments_json')),
  };
}

function buildActivitiesQuery(
  supabase: SupabaseClient<Database>,
  filters?: {
    type?: ActivityType;
    from?: string;
    to?: string;
    location_id?: string;
  }
) {
  let query = supabase.from('activities').select('*, locations(name)');

  if (filters?.type) {
    query = query.eq('activity_type', filters.type);
  }
  if (filters?.from) {
    query = query.gte('started_at', filters.from);
  }
  if (filters?.to) {
    query = query.lte('started_at', filters.to);
  }
  if (filters?.location_id) {
    query = query.eq('location_id', filters.location_id);
  }
  return query;
}

export async function createActivity(
  prev: ActivityFormState,
  formData: FormData
): Promise<ActivityFormState> {
  const supabase = await createSupabaseServerClient();
  const validated = ActivitySchema.safeParse(extractActivityFormData(formData));

  if (!validated.success) {
    return {
      message: 'Validation failed',
      errors: validated.error.flatten().fieldErrors,
    };
  }

  const weather = await fetchActivityWeather(supabase, validated.data.location_id ?? null);

  const { data: inserted, error } = await supabase
    .from('activities')
    .insert({
      activity_type: validated.data.activity_type,
      started_at: validated.data.started_at,
      ended_at: validated.data.ended_at,
      duration_minutes: validated.data.duration_minutes,
      labor_hours: validated.data.labor_hours,
      location_id: validated.data.location_id,
      plot_id: validated.data.plot_id,
      bed_id: validated.data.bed_id,
      nursery_id: validated.data.nursery_id,
      crop: validated.data.crop,
      asset_id: validated.data.asset_id,
      asset_name: validated.data.asset_name,
      quantity: validated.data.quantity,
      unit: validated.data.unit,
      cost: validated.data.cost,
      notes: validated.data.notes,
      weather,
    })
    .select('id')
    .single();

  if (error) {
    console.error('Activities insert error:', error);
    return { message: `Database Error: ${errorToMessage(error)}` };
  }

  await insertSoilAmendments(supabase, validated.data, inserted.id);

  revalidatePath('/activities');
  return { message: 'Activity created successfully', errors: {} };
}

async function fetchActivityWeather(
  supabase: SupabaseClient<Database>,
  locationId: string | null
): Promise<Json | null> {
  if (!locationId) return null;
  const { data: loc, error: locErr } = await supabase
    .from('locations')
    .select('latitude, longitude')
    .eq('id', locationId)
    .single();
  if (!locErr && loc && typeof loc.latitude === 'number' && typeof loc.longitude === 'number') {
    try {
      const w = await fetchWeatherByCoords(loc.latitude, loc.longitude, { units: 'imperial' });
      return w as unknown as Json;
    } catch (e) {
      console.error('Weather fetch failed:', e);
    }
  }
  return null;
}

async function insertSoilAmendments(
  supabase: SupabaseClient<Database>,
  data: ActivityFormValues,
  activityId: number
) {
  if (data.activity_type === 'soil_amendment' && Array.isArray(data.amendments) && activityId) {
    const rows = data.amendments
      .filter((a) => a && typeof a.name === 'string' && a.name.trim().length > 0)
      .map((a) => ({
        activity_id: activityId,
        name: a.name,
        quantity: a.quantity ?? null,
        unit: a.unit ?? null,
        notes: a.notes ?? null,
      }));
    if (rows.length) {
      const { error: aerr } = await supabase.from('activities_soil_amendments').insert(rows);
      if (aerr) console.error('Insert amendments error:', aerr);
    }
  }
}

export async function updateActivity(formData: FormData): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const id = Number(formData.get('id'));
  if (!Number.isFinite(id)) return;

  const validated = ActivitySchema.safeParse(extractActivityFormData(formData));
  if (!validated.success) return;

  // Weather recompute if location changed
  let weather: Json | null = null;
  const locId = validated.data.location_id;
  if (locId) {
    weather = await fetchActivityWeather(supabase, locId);
  }

  const { error } = await supabase
    .from('activities')
    .update({
      activity_type: validated.data.activity_type,
      started_at: validated.data.started_at,
      ended_at: validated.data.ended_at,
      duration_minutes: validated.data.duration_minutes,
      labor_hours: validated.data.labor_hours,
      location_id: validated.data.location_id,
      plot_id: validated.data.plot_id,
      bed_id: validated.data.bed_id,
      nursery_id: validated.data.nursery_id,
      crop: validated.data.crop,
      asset_id: validated.data.asset_id,
      asset_name: validated.data.asset_name,
      quantity: validated.data.quantity,
      unit: validated.data.unit,
      cost: validated.data.cost,
      notes: validated.data.notes,
      weather,
    })
    .eq('id', id);
  if (error) return;
  revalidatePath('/activities');
}

export async function deleteActivity(formData: FormData): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const id = Number(formData.get('id'));
  if (!Number.isFinite(id)) return;
  await supabase.from('activities').delete().eq('id', id);
  revalidatePath('/activities');
}

export async function getActivitiesGrouped(filters?: {
  type?: ActivityType;
  from?: string;
  to?: string;
  location_id?: string;
}) {
  const supabase = await createSupabaseServerClient();
  const query = buildActivitiesQuery(supabase, filters).order('started_at', { ascending: false });

  const { data, error } = await query;
  if (error) return { error: `Database Error: ${error.message}` };
  const grouped: Record<string, Tables<'activities'>[]> = {};
  for (const row of data || []) {
    const k = row.activity_type as string;
    grouped[k] ||= [];
    grouped[k].push(row);
  }
  return { grouped };
}

export async function getActivitiesFlat(params?: {
  type?: ActivityType;
  from?: string;
  to?: string;
  location_id?: string;
  sort?: 'started_at' | 'labor_hours' | 'cost';
  dir?: 'asc' | 'desc';
}) {
  const supabase = await createSupabaseServerClient();
  let query = buildActivitiesQuery(supabase, params);

  const sort = params?.sort ?? 'started_at';
  const dir = params?.dir ?? 'desc';
  query = query.order(sort, { ascending: dir === 'asc' });

  const { data, error } = await query;
  if (error) return { error: `Database Error: ${error.message}` };
  return { rows: data || [] };
}

export async function deleteActivitiesBulk(formData: FormData): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const csv = getString(formData.get('ids'));
  const ids = csv
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
  if (!ids.length) return;
  await supabase.from('activities').delete().in('id', ids);
  revalidatePath('/activities');
}

export async function renameBed(formData: FormData): Promise<{ message: string }> {
  const supabase = await createSupabaseServerClient();
  const id = Number(formData.get('bed_id'));
  const name = getString(formData.get('name')).trim();
  if (!Number.isFinite(id) || !name) return { message: 'Missing bed id or name' };
  const { error } = await supabase.from('beds').update({ name }).eq('id', id);
  if (error) return { message: `Database Error: ${errorToMessage(error)}` };
  return { message: 'Bed renamed' };
}
