'use server';

import { createSupabaseServerClient, getUserAndProfile, type Tables } from '@/lib/supabase-server';
import { isAdmin } from '@/lib/authz';
import { revalidatePath } from 'next/cache';

type Nursery = Tables<'nurseries'>;
type Location = Tables<'locations'>;

export async function getNurseries(): Promise<{ nurseries?: Nursery[]; error?: string }> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('nurseries')
    .select('*')
    .order('name', { ascending: true });
  if (error) return { error: error.message };
  return { nurseries: (data as Nursery[]) || [] };
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
  return { locations: (data as Pick<Location, 'id' | 'name'>[]) || [] };
}

export async function createNursery(input: { name: string; location_id: string; notes?: string }) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from('nurseries')
    .insert({ name: input.name, location_id: input.location_id, notes: input.notes ?? null });
  if (error) return { error: error.message };
  return { ok: true } as const;
}

export async function updateNursery(input: {
  id: string;
  name: string;
  location_id: string;
  notes?: string;
}) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from('nurseries')
    .update({ name: input.name, location_id: input.location_id, notes: input.notes ?? null })
    .eq('id', input.id);
  if (error) return { error: error.message };
  return { ok: true } as const;
}

export async function deleteNursery(id: string) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from('nurseries').delete().eq('id', id);
  if (error) return { error: error.message };
  return { ok: true } as const;
}

// UI-friendly server actions using FormData
export type NurseryFormState = { message: string; errors?: Record<string, string[] | undefined> };

export async function actionCreateNursery(
  prev: NurseryFormState,
  formData: FormData
): Promise<NurseryFormState> {
  const { user, profile } = await getUserAndProfile();
  if (!user || !isAdmin(profile)) {
    return { message: 'Unauthorized' };
  }
  const supabase = await createSupabaseServerClient();
  const name = String(formData.get('name') || '');
  const location_id = String(formData.get('location_id') || '');
  const notesValue = formData.get('notes');
  const notes = typeof notesValue === 'string' ? notesValue : undefined;
  if (!name.trim())
    return {
      message: 'Please fix the highlighted fields.',
      errors: { name: ['Name is required'] },
    };
  if (!location_id)
    return {
      message: 'Please fix the highlighted fields.',
      errors: { location_id: ['Location is required'] },
    };
  const { error } = await supabase
    .from('nurseries')
    .insert({ name, location_id, notes: notes ?? null });
  if (error) return { message: 'Failed to create nursery. Please try again.' };
  revalidatePath('/nurseries');
  return { message: 'Nursery created.' };
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
  const id = String(formData.get('id') || '');
  const name = String(formData.get('name') || '');
  const location_id = String(formData.get('location_id') || '');
  const notesValue = formData.get('notes');
  const notes = typeof notesValue === 'string' ? notesValue : undefined;
  if (!id) return { message: 'Something went wrong. Please close and try again.' };
  if (!name.trim())
    return {
      message: 'Please fix the highlighted fields.',
      errors: { name: ['Name is required'] },
    };
  if (!location_id)
    return {
      message: 'Please fix the highlighted fields.',
      errors: { location_id: ['Location is required'] },
    };
  const { error } = await supabase
    .from('nurseries')
    .update({ name, location_id, notes: notes ?? null })
    .eq('id', id);
  if (error) return { message: 'Failed to update nursery. Please try again.' };
  revalidatePath('/nurseries');
  return { message: 'Nursery updated.' };
}

export async function actionDeleteNursery(id: string): Promise<NurseryFormState> {
  const { user, profile } = await getUserAndProfile();
  if (!user || !isAdmin(profile)) {
    return { message: 'Unauthorized' };
  }
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from('nurseries').delete().eq('id', id);
  if (error) {
    return { message: 'Failed to delete nursery. Please try again.' };
  }
  revalidatePath('/nurseries');
  return { message: 'Nursery deleted.', errors: {} };
}
