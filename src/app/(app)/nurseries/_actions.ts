'use server';

import { createSupabaseServerClient, getUserAndProfile, type Tables } from '@/lib/supabase-server';
import { isAdmin } from '@/lib/authz';
import { revalidatePath } from 'next/cache';
import {
  asActionError,
  asActionSuccess,
  createCorrelationId,
  logActionError,
  mapZodFieldErrors,
  type ActionResult,
} from '@/lib/action-result';
import { mapDbError } from '@/lib/error-mapper';
import { z } from 'zod';

type Nursery = Tables<'nurseries'>;
type Location = Tables<'locations'>;

const NurserySchema = z.object({
  id: z.string().uuid({ message: 'Invalid id' }).optional(),
  name: z.string().trim().min(1, 'Name is required'),
  location_id: z.string().uuid({ message: 'Location is invalid' }),
  notes: z.string().trim().optional().nullable(),
});

const requireAdmin = async (): Promise<{ ok: true } | { error: string }> => {
  const { user, profile } = await getUserAndProfile();
  if (!user || !isAdmin(profile)) {
    return { error: 'Unauthorized' };
  }
  return { ok: true };
};

function getStringField(value: FormDataEntryValue | null): string | null {
  return typeof value === 'string' ? value : null;
}

const isUuid = (value: string): boolean =>
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(
    value
  );

export async function getNurseries(): Promise<{ nurseries?: Nursery[]; error?: string }> {
  const auth = await requireAdmin();
  if ('error' in auth) return { error: auth.error };
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
  const auth = await requireAdmin();
  if ('error' in auth) return { error: auth.error };
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('locations')
    .select('id, name')
    .order('name', { ascending: true });
  if (error) return { error: error.message };
  return { locations: data ?? [] };
}

export async function createNursery(input: {
  name: string;
  location_id: string;
  notes?: string;
}): Promise<ActionResult<{ nursery: Nursery }>> {
  const correlationId = createCorrelationId();
  const { user, profile } = await getUserAndProfile();
  if (!user || !isAdmin(profile)) {
    return asActionError({
      code: 'unauthorized',
      message: 'Unauthorized',
      correlationId,
    });
  }
  const supabase = await createSupabaseServerClient();
  const validation = NurserySchema.safeParse(input);
  if (!validation.success) {
    return asActionError({
      code: 'validation',
      message: 'Please fix the highlighted fields.',
      fieldErrors: mapZodFieldErrors(validation.error),
      correlationId,
    });
  }
  const { data, error } = await supabase
    .from('nurseries')
    .insert({
      name: validation.data.name,
      location_id: validation.data.location_id,
      notes: validation.data.notes ?? null,
    })
    .select('*')
    .single();
  if (error) {
    const actionError = mapDbError(error, correlationId, 'Failed to create nursery.');
    logActionError('createNursery.rpc', actionError);
    return actionError;
  }
  return asActionSuccess({ nursery: data as Nursery }, 'Nursery created.', correlationId);
}

export async function updateNursery(input: {
  id: string;
  name: string;
  location_id: string;
  notes?: string;
}): Promise<ActionResult<{ nursery: Nursery }>> {
  const correlationId = createCorrelationId();
  const { user, profile } = await getUserAndProfile();
  if (!user || !isAdmin(profile)) {
    return asActionError({
      code: 'unauthorized',
      message: 'Unauthorized',
      correlationId,
    });
  }
  const supabase = await createSupabaseServerClient();
  const validation = NurserySchema.extend({
    id: z.string().uuid({ message: 'Invalid id' }),
  }).safeParse(input);
  if (!validation.success) {
    return asActionError({
      code: 'validation',
      message: 'Please fix the highlighted fields.',
      fieldErrors: mapZodFieldErrors(validation.error),
      correlationId,
    });
  }
  const { data, error } = await supabase
    .from('nurseries')
    .update({
      name: validation.data.name,
      location_id: validation.data.location_id,
      notes: validation.data.notes ?? null,
    })
    .eq('id', validation.data.id)
    .select('*')
    .single();
  if (error) {
    const actionError = mapDbError(error, correlationId, 'Failed to update nursery.');
    logActionError('updateNursery.rpc', actionError, { id: validation.data.id });
    return actionError;
  }
  return asActionSuccess({ nursery: data as Nursery }, 'Nursery updated.', correlationId);
}

export async function deleteNursery(id: string): Promise<ActionResult<{ id: string }>> {
  const correlationId = createCorrelationId();
  const { user, profile } = await getUserAndProfile();
  if (!user || !isAdmin(profile)) {
    return asActionError({
      code: 'unauthorized',
      message: 'Unauthorized',
      correlationId,
    });
  }
  const supabase = await createSupabaseServerClient();
  if (!id || !isUuid(id)) {
    return asActionError({
      code: 'validation',
      message: 'Invalid id',
      fieldErrors: { id: ['Invalid id'] },
      correlationId,
    });
  }
  const { error } = await supabase.from('nurseries').delete().eq('id', id);
  if (error) {
    const actionError = mapDbError(error, correlationId, 'Failed to delete nursery.');
    logActionError('deleteNursery.rpc', actionError, { id });
    return actionError;
  }
  return asActionSuccess({ id }, 'Nursery deleted.', correlationId);
}

// UI-friendly server actions using FormData
export type NurseryFormState = ActionResult<{ nursery: Nursery | null }>;

export async function actionCreateNursery(
  prev: NurseryFormState,
  formData: FormData
): Promise<NurseryFormState> {
  const correlationId = createCorrelationId();
  const { user, profile } = await getUserAndProfile();
  if (!user || !isAdmin(profile)) {
    return asActionError({
      code: 'unauthorized',
      message: 'Unauthorized',
      correlationId,
    });
  }
  const supabase = await createSupabaseServerClient();
  const nameValue = getStringField(formData.get('name'));
  const locationValue = getStringField(formData.get('location_id'));
  const notesValue = getStringField(formData.get('notes'));
  const name = nameValue?.trim() ?? '';
  const location_id = locationValue?.trim() ?? '';
  const notes = notesValue ?? undefined;
  const validation = NurserySchema.safeParse({
    name,
    location_id,
    notes,
  });
  if (!validation.success) {
    const error = asActionError({
      code: 'validation',
      message: 'Please fix the highlighted fields.',
      fieldErrors: mapZodFieldErrors(validation.error),
      correlationId,
    });
    logActionError('actionCreateNursery.validation', error);
    return error;
  }
  const { data, error } = await supabase
    .from('nurseries')
    .insert({
      name: validation.data.name,
      location_id: validation.data.location_id,
      notes: validation.data.notes ?? null,
    })
    .select('*')
    .single();
  if (error || !data) {
    const actionError = mapDbError(
      error ?? { code: 'server', message: 'Insert failed', details: null },
      correlationId
    );
    logActionError('actionCreateNursery.insert', actionError);
    return actionError;
  }
  revalidatePath('/nurseries');
  return asActionSuccess({ nursery: data as Nursery }, 'Nursery created.', correlationId);
}

export async function actionUpdateNursery(
  prev: NurseryFormState,
  formData: FormData
): Promise<NurseryFormState> {
  const correlationId = createCorrelationId();
  const { user, profile } = await getUserAndProfile();
  if (!user || !isAdmin(profile)) {
    return asActionError({
      code: 'unauthorized',
      message: 'Unauthorized',
      correlationId,
    });
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
  const validation = NurserySchema.extend({
    id: z.string().uuid({ message: 'Invalid id' }),
  }).safeParse({
    id,
    name,
    location_id,
    notes,
  });
  if (!validation.success) {
    const error = asActionError({
      code: 'validation',
      message: 'Please fix the highlighted fields.',
      fieldErrors: mapZodFieldErrors(validation.error),
      correlationId,
    });
    logActionError('actionUpdateNursery.validation', error);
    return error;
  }
  const { data, error } = await supabase
    .from('nurseries')
    .update({
      name: validation.data.name,
      location_id: validation.data.location_id,
      notes: validation.data.notes ?? null,
    })
    .eq('id', validation.data.id)
    .select('*')
    .single();
  if (error || !data) {
    const actionError = mapDbError(
      error ?? { code: 'server', message: 'Update failed', details: null },
      correlationId
    );
    logActionError('actionUpdateNursery.update', actionError, { id: validation.data.id });
    return actionError;
  }
  revalidatePath('/nurseries');
  return asActionSuccess({ nursery: data as Nursery }, 'Nursery updated.', correlationId);
}

export async function actionDeleteNursery(id: string): Promise<NurseryFormState> {
  const correlationId = createCorrelationId();
  const { user, profile } = await getUserAndProfile();
  if (!user || !isAdmin(profile)) {
    return asActionError({
      code: 'unauthorized',
      message: 'Unauthorized',
      correlationId,
    });
  }
  const trimmedId = typeof id === 'string' ? id.trim() : '';
  if (!trimmedId || !isUuid(trimmedId)) {
    const error = asActionError({
      code: 'validation',
      message: 'Please fix the highlighted fields.',
      fieldErrors: { id: ['Invalid id'] },
      correlationId,
    });
    logActionError('actionDeleteNursery.validation', error);
    return error;
  }
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from('nurseries').delete().eq('id', trimmedId);
  if (error) {
    const actionError = mapDbError(error, correlationId, 'Failed to delete nursery.');
    logActionError('actionDeleteNursery.rpc', actionError, { id: trimmedId });
    return actionError;
  }
  revalidatePath('/nurseries');
  return asActionSuccess({ nursery: null }, 'Nursery deleted.', correlationId);
}

export type NurseryStats = Record<
  string,
  {
    activeSows: number;
    lastSowDate: string | null;
  }
>;

export async function getNurseryStats(): Promise<{ stats: NurseryStats; error?: string }> {
  const auth = await requireAdmin();
  if ('error' in auth) return { stats: {}, error: auth.error };
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
