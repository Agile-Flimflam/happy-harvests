'use server';

import { createSupabaseServerClient, getUserAndProfile, type Tables } from '@/lib/supabase-server';
import { isAdmin } from '@/lib/authz';
import { revalidatePath } from 'next/cache';

type Nursery = Tables<'nurseries'>;
type Location = Tables<'locations'>;

function getStringField(value: FormDataEntryValue | null): string | null {
  return typeof value === 'string' ? value : null;
}

const isUuid = (value: string): boolean =>
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(
    value
  );

export async function getNurseries(): Promise<{ nurseries?: Nursery[]; error?: string }> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('nurseries')
    .select('*')
    .order('name', { ascending: true });
  if (error) return { error: error.message };
  return { nurseries: data ?? [] };
}

export async function getLocationsForSelect(): Promise<{
  locations?: Pick<Location, 'id' | 'name'>[];
  error?: string;
}> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('locations')
    .select('id, name')
    .order('name', { ascending: true });
  if (error) return { error: error.message };
  return { locations: data ?? [] };
}

export async function createNursery(input: { name: string; location_id: string; notes?: string }) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('nurseries')
    .insert({ name: input.name, location_id: input.location_id, notes: input.notes ?? null })
    .select('*')
    .single();
  if (error) return { error: error.message };
  return { ok: true as const, nursery: data as Nursery };
}

export async function updateNursery(input: {
  id: string;
  name: string;
  location_id: string;
  notes?: string;
}) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('nurseries')
    .update({ name: input.name, location_id: input.location_id, notes: input.notes ?? null })
    .eq('id', input.id)
    .select('*')
    .single();
  if (error) return { error: error.message };
  return { ok: true as const, nursery: data as Nursery };
}

export async function deleteNursery(id: string) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from('nurseries').delete().eq('id', id);
  if (error) return { error: error.message };
  return { ok: true } as const;
}

// UI-friendly server actions using FormData
export type NurseryFormState = {
  message: string;
  errors?: Record<string, string[] | undefined>;
  nursery?: Nursery | null;
};

export async function actionCreateNursery(
  prev: NurseryFormState,
  formData: FormData
): Promise<NurseryFormState> {
  const { user, profile } = await getUserAndProfile();
  if (!user || !isAdmin(profile)) {
    return { message: 'Unauthorized' };
  }
  const supabase = await createSupabaseServerClient();
  const nameValue = getStringField(formData.get('name'));
  const locationValue = getStringField(formData.get('location_id'));
  const notesValue = getStringField(formData.get('notes'));
  const name = nameValue?.trim() ?? '';
  const location_id = locationValue?.trim() ?? '';
  const notes = notesValue ?? undefined;
  if (!name)
    return {
      message: 'Please fix the highlighted fields.',
      errors: { name: ['Name is required'] },
    };
  if (!location_id || !isUuid(location_id))
    return {
      message: 'Please fix the highlighted fields.',
      errors: {
        location_id: [location_id ? 'Location is invalid' : 'Location is required'],
      },
    };
  const { data, error } = await supabase
    .from('nurseries')
    .insert({ name, location_id, notes: notes ?? null })
    .select('*')
    .single();
  if (error || !data) return { message: 'Failed to create nursery. Please try again.' };
  revalidatePath('/nurseries');
  return { message: 'Nursery created.', errors: {}, nursery: data as Nursery };
}

export async function actionUpdateNursery(
  prev: NurseryFormState,
  formData: FormData
): Promise<NurseryFormState> {
  const { user, profile } = await getUserAndProfile();
  if (!user || !isAdmin(profile)) {
    return { message: 'Unauthorized' };
  }
  const supabase = await createSupabaseServerClient();
  const idValue = getStringField(formData.get('id'));
  const nameValue = getStringField(formData.get('name'));
  const locationValue = getStringField(formData.get('location_id'));
  const notesValue = getStringField(formData.get('notes'));
  const id = idValue?.trim() ?? '';
  const name = nameValue?.trim() ?? '';
  const location_id = locationValue?.trim() ?? '';
  const notes = notesValue ?? undefined;
  if (!id || !isUuid(id)) {
    return {
      message: 'Please fix the highlighted fields.',
      errors: {
        id: [id ? 'Invalid id' : 'Something went wrong. Please close and try again.'],
      },
    };
  }
  if (!name.trim())
    return {
      message: 'Please fix the highlighted fields.',
      errors: { name: ['Name is required'] },
    };
  if (!location_id || !isUuid(location_id))
    return {
      message: 'Please fix the highlighted fields.',
      errors: {
        location_id: [location_id ? 'Location is invalid' : 'Location is required'],
      },
    };
  const { data, error } = await supabase
    .from('nurseries')
    .update({ name, location_id, notes: notes ?? null })
    .eq('id', id)
    .select('*')
    .single();
  if (error || !data) return { message: 'Failed to update nursery. Please try again.' };
  revalidatePath('/nurseries');
  return { message: 'Nursery updated.', errors: {}, nursery: data as Nursery };
}

export async function actionDeleteNursery(id: string): Promise<NurseryFormState> {
  const { user, profile } = await getUserAndProfile();
  if (!user || !isAdmin(profile)) {
    return { message: 'Unauthorized' };
  }
  const trimmedId = typeof id === 'string' ? id.trim() : '';
  if (!trimmedId || !isUuid(trimmedId)) {
    return {
      message: 'Please fix the highlighted fields.',
      errors: { id: ['Invalid id'] },
    };
  }
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from('nurseries').delete().eq('id', trimmedId);
  if (error) {
    return { message: 'Failed to delete nursery. Please try again.' };
  }
  revalidatePath('/nurseries');
  return { message: 'Nursery deleted.', errors: {} };
}

export type NurseryStats = Record<
  string,
  {
    activeSows: number;
    lastSowDate: string | null;
  }
>;

export async function getNurseryStats(): Promise<{ stats: NurseryStats; error?: string }> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('plantings')
    .select('nursery_id, nursery_started_date, status')
    .eq('status', 'nursery')
    .not('nursery_id', 'is', null);
  if (error) {
    return { stats: {}, error: error.message };
  }
  const stats: NurseryStats = {};
  (data ?? []).forEach((row) => {
    const nurseryId = row.nursery_id as string;
    if (!nurseryId) return;
    const existing = stats[nurseryId] ?? { activeSows: 0, lastSowDate: null };
    existing.activeSows += 1;
    if (row.nursery_started_date) {
      const current = existing.lastSowDate;
      if (!current || row.nursery_started_date > current) {
        existing.lastSowDate = row.nursery_started_date;
      }
    }
    stats[nurseryId] = existing;
  });
  return { stats };
}
