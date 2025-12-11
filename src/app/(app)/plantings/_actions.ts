'use server';

import { createSupabaseServerClient, type Tables } from '@/lib/supabase-server';
import type { Database } from '@/lib/database.types';
import type { PlantingWithDetails } from '@/lib/types';
import { revalidatePath } from 'next/cache';
import { NurserySowSchema } from '@/lib/validation/plantings/nursery-sow';
import { DirectSeedSchema } from '@/lib/validation/plantings/direct-seed';
import { HarvestSchema } from '@/lib/validation/plantings/harvest';
import { RemoveSchema } from '@/lib/validation/plantings/remove';
import {
  deletePlantingTemplate,
  getPlantingPrefs,
  pushPlantingRecents,
  savePlantingTemplate,
  type PlantingDefaults,
  type PlantingPrefs,
  type PlantingTemplate,
} from '@/lib/planting-prefs';
import {
  asActionError,
  asActionSuccess,
  createCorrelationId,
  logActionError,
  mapZodFieldErrors,
  type ActionResult,
} from '@/lib/action-result';
import { mapDbError } from '@/lib/error-mapper';

type Planting = Tables<'plantings'>;

type PlantingActionData = {
  planting?: Planting | null;
  undoId?: number | null;
};

export type PlantingFormState = ActionResult<PlantingActionData>;

const DAILY_NURSERY_SOW_LIMIT = 20;
const DAILY_BED_PLANT_LIMIT = 5;
const ATTACHMENT_BUCKET = 'nursery_sow_attachments';
const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;
const ALLOWED_ATTACHMENT_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];
const PLANTING_DRAFT_KEY = 'plantingDraft';

const isFileLike = (value: unknown): value is File =>
  typeof File !== 'undefined' && value instanceof File;

const getFileExtension = (file: File): string => {
  const name = file.name || '';
  const dotIdx = name.lastIndexOf('.');
  if (dotIdx !== -1) return name.slice(dotIdx + 1).toLowerCase();
  const mime = file.type || '';
  switch (mime) {
    case 'image/jpeg':
      return 'jpg';
    case 'image/png':
      return 'png';
    case 'image/webp':
      return 'webp';
    case 'image/avif':
      return 'avif';
    default:
      return 'bin';
  }
};

type LocationOption = Pick<Tables<'locations'>, 'id' | 'name'>;
type PlotOption = Pick<Tables<'plots'>, 'plot_id' | 'name' | 'location_id'>;
type BedOption = Pick<Tables<'beds'>, 'id' | 'name' | 'plot_id'> & {
  plots?: { location_id: string | null } | null;
};

const dedupeNumbers = (ids: number[]): number[] => {
  const seen = new Set<number>();
  const next: number[] = [];
  ids.forEach((id) => {
    if (!Number.isFinite(id)) return;
    if (seen.has(id)) return;
    seen.add(id);
    next.push(id);
  });
  return next;
};

export type PlantingOptionsResponse = {
  locations: LocationOption[];
  plots: PlotOption[];
  beds: BedOption[];
  nurseries: { id: string; name: string }[];
  varieties: {
    id: number;
    name: string;
    latin_name: string;
    crops?: { name: string } | null;
  }[];
  prefs: PlantingPrefs | null;
  templates: PlantingTemplate[];
  defaults?: PlantingDefaults;
  error?: string;
};

export async function getPlantingOptions(): Promise<PlantingOptionsResponse> {
  const supabase = await createSupabaseServerClient();
  const [
    { data: locations, error: locErr },
    { data: plots, error: plotErr },
    { data: beds, error: bedErr },
    { data: nurseries, error: nurseryErr },
    { data: varieties, error: varietyErr },
    prefs,
  ] = await Promise.all([
    supabase.from('locations').select('id, name').order('name', { ascending: true }),
    supabase.from('plots').select('plot_id, name, location_id').order('name', { ascending: true }),
    supabase
      .from('beds')
      .select('id, name, plot_id, plots(location_id)')
      .order('name', { ascending: true }),
    supabase.from('nurseries').select('id, name').order('name', { ascending: true }),
    supabase
      .from('crop_varieties')
      .select('id, name, latin_name, crops(name)')
      .order('name', { ascending: true }),
    getPlantingPrefs(),
  ]);
  const error =
    locErr?.message ||
    plotErr?.message ||
    bedErr?.message ||
    nurseryErr?.message ||
    varietyErr?.message;
  return {
    locations: (locations ?? []) as LocationOption[],
    plots: (plots ?? []) as PlotOption[],
    beds: (beds ?? []) as BedOption[],
    nurseries: (nurseries ?? []) as { id: string; name: string }[],
    varieties: (varieties ?? []) as {
      id: number;
      name: string;
      latin_name: string;
      crops?: { name: string } | null;
    }[],
    prefs: prefs ?? null,
    templates: prefs?.templates ?? [],
    defaults: prefs?.defaults,
    error: error || undefined,
  };
}

export type PlantingDraft = {
  locationId?: string | null;
  plotId?: number | null;
  bedId?: number | null;
  nurseryId?: string | null;
  varietyId?: number | null;
  mode?: 'direct' | 'nursery';
  date?: string | null;
  notes?: string | null;
  qty?: number | null;
  weightGrams?: number | null;
};

const isDraft = (value: unknown): value is PlantingDraft =>
  typeof value === 'object' && value !== null;

export async function loadPlantingDraft(): Promise<PlantingDraft | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const raw = user.user_metadata?.[PLANTING_DRAFT_KEY];
  return isDraft(raw) ? (raw as PlantingDraft) : null;
}

export async function savePlantingDraft(
  draft: PlantingDraft
): Promise<{ ok: true } | { error: string }> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.updateUser({
    data: { [PLANTING_DRAFT_KEY]: draft },
  });
  if (error) return { error: error.message };
  return { ok: true };
}

export async function clearPlantingDraft(): Promise<{ ok: true } | { error: string }> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.updateUser({
    data: { [PLANTING_DRAFT_KEY]: null },
  });
  if (error) return { error: error.message };
  return { ok: true };
}

// Server Actions for form submissions (UI-friendly)
export async function actionNurserySow(
  prev: PlantingFormState,
  formData: FormData
): Promise<PlantingFormState> {
  const correlationId = createCorrelationId();
  const supabase = await createSupabaseServerClient();
  const validation = NurserySowSchema.safeParse({
    crop_variety_id: formData.get('crop_variety_id'),
    qty: formData.get('qty'),
    nursery_id: formData.get('nursery_id'),
    event_date: formData.get('event_date'),
    notes: formData.get('notes'),
    weight_grams: formData.get('weight_grams'),
  });
  if (!validation.success) {
    const error = asActionError({
      code: 'validation',
      message: 'Please fix the highlighted fields.',
      fieldErrors: mapZodFieldErrors(validation.error),
      correlationId,
    });
    logActionError('actionNurserySow.validation', error);
    return error;
  }
  const {
    crop_variety_id: cropVarietyId,
    qty,
    nursery_id: nurseryId,
    event_date: eventDate,
    notes,
    weight_grams: weightGrams,
  } = validation.data;

  // Capacity/conflict: block duplicate sow for same nursery/date/variety and too many daily sowings.
  const { data: sameDay, error: conflictError } = await supabase
    .from('plantings')
    .select('id, crop_variety_id')
    .eq('nursery_id', nurseryId)
    .eq('status', 'nursery')
    .eq('nursery_started_date', eventDate);
  if (conflictError) {
    const error = mapDbError(conflictError, correlationId, 'Database error while checking nursery');
    logActionError('actionNurserySow.conflictQuery', error, { nurseryId, eventDate });
    return error;
  }
  if (sameDay?.some((row) => row.crop_variety_id === cropVarietyId)) {
    const error = asActionError({
      code: 'duplicate',
      message: 'A sowing for this variety already exists on this date.',
      fieldErrors: { crop_variety_id: ['Duplicate sowing for this date'] },
      correlationId,
      retryable: false,
    });
    logActionError('actionNurserySow.duplicate', error, { nurseryId, eventDate, cropVarietyId });
    return error;
  }
  if ((sameDay?.length ?? 0) >= DAILY_NURSERY_SOW_LIMIT) {
    const error = asActionError({
      code: 'capacity_exceeded',
      message:
        'Nursery capacity reached for this date. Choose another date or update existing sowings.',
      fieldErrors: { event_date: ['Capacity reached for selected date'] },
      correlationId,
      retryable: false,
    });
    logActionError('actionNurserySow.capacity', error, { nurseryId, eventDate });
    return error;
  }

  let notesToPersist = notes ?? undefined;
  const attachmentEntry = formData.get('attachment');
  const attachment = isFileLike(attachmentEntry) ? attachmentEntry : null;
  if (attachment) {
    if (!ALLOWED_ATTACHMENT_TYPES.includes(attachment.type)) {
      const error = asActionError({
        code: 'validation',
        message: 'Attachment type not supported. Use JPEG, PNG, WEBP, or AVIF.',
        fieldErrors: { notes: ['Unsupported attachment type'] },
        correlationId,
      });
      logActionError('actionNurserySow.attachmentType', error);
      return error;
    }
    if (attachment.size > MAX_ATTACHMENT_BYTES) {
      const error = asActionError({
        code: 'validation',
        message: 'Attachment too large (max 5MB).',
        fieldErrors: { notes: ['Attachment exceeds 5MB'] },
        correlationId,
      });
      logActionError('actionNurserySow.attachmentSize', error);
      return error;
    }
    const ext = getFileExtension(attachment);
    const randomSuffix = Math.random().toString(36).slice(2, 8);
    const path = `${nurseryId}/${Date.now()}_${randomSuffix}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from(ATTACHMENT_BUCKET)
      .upload(path, attachment, {
        cacheControl: '3600',
        upsert: true,
        contentType: attachment.type || 'application/octet-stream',
      });
    if (uploadError) {
      const error = mapDbError(
        {
          code: uploadError.name,
          message: uploadError.message,
          details: String(uploadError.cause ?? ''),
        },
        correlationId,
        'Attachment upload failed.'
      );
      logActionError('actionNurserySow.attachmentUpload', error);
      return error;
    }
    const publicUrl =
      supabase.storage.from(ATTACHMENT_BUCKET).getPublicUrl(path).data?.publicUrl ?? null;
    if (publicUrl) {
      notesToPersist = notesToPersist
        ? `${notesToPersist}\nAttachment: ${publicUrl}`
        : `Attachment: ${publicUrl}`;
    }
  }

  const { error } = await supabase.rpc('fn_create_nursery_planting', {
    p_crop_variety_id: cropVarietyId,
    p_qty: qty,
    p_nursery_id: nurseryId,
    p_event_date: eventDate,
    p_notes: notesToPersist ?? undefined,
    p_weight_grams: weightGrams ?? undefined,
  } as unknown as Database['public']['Functions']['fn_create_nursery_planting']['Args']);
  if (error) {
    const actionError = mapDbError(error, correlationId, 'Failed to create nursery planting.');
    logActionError('actionNurserySow.rpc', actionError, { nurseryId, eventDate });
    return actionError;
  }
  revalidatePath('/plantings');
  revalidatePath('/nurseries');
  await pushPlantingRecents({
    nurseryId,
    varietyId: cropVarietyId,
    defaults: {
      nurseryId,
      varietyId: cropVarietyId,
      mode: 'nursery',
      qty,
      date: eventDate,
      weightGrams,
    },
  });
  return asActionSuccess(
    { planting: null, undoId: null },
    'Nursery planting created.',
    correlationId
  );
}

export async function actionDirectSeed(
  prev: PlantingFormState,
  formData: FormData
): Promise<PlantingFormState> {
  const correlationId = createCorrelationId();
  const supabase = await createSupabaseServerClient();
  const validation = DirectSeedSchema.safeParse({
    crop_variety_id: formData.get('crop_variety_id'),
    qty: formData.get('qty'),
    bed_id: formData.get('bed_id'),
    event_date: formData.get('event_date'),
    notes: formData.get('notes'),
    weight_grams: formData.get('weight_grams'),
  });
  if (!validation.success) {
    const error = asActionError({
      code: 'validation',
      message: 'Please fix the highlighted fields.',
      fieldErrors: mapZodFieldErrors(validation.error),
      correlationId,
    });
    logActionError('actionDirectSeed.validation', error);
    return error;
  }
  const {
    crop_variety_id: cropVarietyId,
    qty,
    bed_id: bedId,
    event_date: eventDate,
    notes,
    weight_grams: weightGrams,
  } = validation.data;

  const { data: conflicts, error: conflictError } = await supabase
    .from('plantings')
    .select('id')
    .eq('bed_id', bedId)
    .eq('planted_date', eventDate)
    .not('status', 'eq', 'removed');
  if (conflictError) {
    const error = mapDbError(conflictError, correlationId, 'Database error while checking bed');
    logActionError('actionDirectSeed.conflictQuery', error, { bedId, eventDate });
    return error;
  }
  if ((conflicts?.length ?? 0) >= DAILY_BED_PLANT_LIMIT) {
    const error = asActionError({
      code: 'overlap',
      message: 'This bed already has plantings on that date.',
      fieldErrors: { bed_id: ['Bed is already scheduled for that date'] },
      correlationId,
      retryable: false,
    });
    logActionError('actionDirectSeed.bedOverlap', error, { bedId, eventDate });
    return error;
  }

  let notesToPersist = notes ?? undefined;
  const attachmentEntry = formData.get('attachment');
  const attachment = isFileLike(attachmentEntry) ? attachmentEntry : null;
  if (attachment) {
    if (!ALLOWED_ATTACHMENT_TYPES.includes(attachment.type)) {
      const error = asActionError({
        code: 'validation',
        message: 'Attachment type not supported. Use JPEG, PNG, WEBP, or AVIF.',
        correlationId,
      });
      logActionError('actionDirectSeed.attachmentType', error);
      return error;
    }
    if (attachment.size > MAX_ATTACHMENT_BYTES) {
      const error = asActionError({
        code: 'validation',
        message: 'Attachment too large (max 5MB).',
        correlationId,
      });
      logActionError('actionDirectSeed.attachmentSize', error);
      return error;
    }
    const ext = getFileExtension(attachment);
    const randomSuffix = Math.random().toString(36).slice(2, 8);
    const path = `${bedId}/${Date.now()}_${randomSuffix}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from(ATTACHMENT_BUCKET)
      .upload(path, attachment, {
        cacheControl: '3600',
        upsert: true,
        contentType: attachment.type || 'application/octet-stream',
      });
    if (uploadError) {
      const error = mapDbError(
        {
          code: uploadError.name,
          message: uploadError.message,
          details: String(uploadError.cause ?? ''),
        },
        correlationId,
        'Attachment upload failed.'
      );
      logActionError('actionDirectSeed.attachmentUpload', error);
      return error;
    }
    const publicUrl =
      supabase.storage.from(ATTACHMENT_BUCKET).getPublicUrl(path).data?.publicUrl ?? null;
    if (publicUrl) {
      notesToPersist = notesToPersist
        ? `${notesToPersist}\nAttachment: ${publicUrl}`
        : `Attachment: ${publicUrl}`;
    }
  }

  const { error } = await supabase.rpc('fn_create_direct_seed_planting', {
    p_crop_variety_id: cropVarietyId,
    p_qty: qty,
    p_bed_id: bedId,
    p_event_date: eventDate,
    p_notes: notesToPersist ?? undefined,
    p_weight_grams: weightGrams ?? undefined,
  } as unknown as Database['public']['Functions']['fn_create_direct_seed_planting']['Args']);
  if (error) {
    const actionError = mapDbError(error, correlationId, 'Failed to create direct seed planting.');
    logActionError('actionDirectSeed.rpc', actionError, { bedId, eventDate });
    return actionError;
  }
  revalidatePath('/plantings');
  await pushPlantingRecents({
    bedId,
    varietyId: cropVarietyId,
    defaults: {
      bedId,
      varietyId: cropVarietyId,
      mode: 'direct',
      qty,
      date: eventDate,
      weightGrams,
    },
  });
  return asActionSuccess(
    { planting: null, undoId: null },
    'Direct-seeded planting created.',
    correlationId
  );
}

export type BulkDirectSeedInput = {
  bedIds: number[];
  crop_variety_id: number;
  qty: number;
  event_date: string;
  notes?: string;
  weight_grams?: number | null;
};

export type BulkDirectSeedResult = {
  message: string;
  successes: Array<{ bedId: number }>;
  failures: Array<{ bedId: number; error: string }>;
};

export async function bulkCreateDirectSeedPlantings(
  input: BulkDirectSeedInput
): Promise<BulkDirectSeedResult> {
  const supabase = await createSupabaseServerClient();
  const uniqueBedIds = dedupeNumbers(input.bedIds);
  const successes: Array<{ bedId: number }> = [];
  const failures: Array<{ bedId: number; error: string }> = [];

  for (const bedId of uniqueBedIds) {
    const { error } = await supabase.rpc('fn_create_direct_seed_planting', {
      p_crop_variety_id: input.crop_variety_id,
      p_qty: input.qty,
      p_bed_id: bedId,
      p_event_date: input.event_date,
      p_notes: input.notes ?? undefined,
      p_weight_grams: input.weight_grams ?? undefined,
    } as unknown as Database['public']['Functions']['fn_create_direct_seed_planting']['Args']);
    if (error) {
      failures.push({ bedId, error: error.message });
    } else {
      successes.push({ bedId });
    }
  }

  if (successes.length) {
    revalidatePath('/plantings');
    await pushPlantingRecents({
      bedId: successes[0]?.bedId,
      varietyId: input.crop_variety_id,
      defaults: {
        bedId: successes[0]?.bedId,
        varietyId: input.crop_variety_id,
        qty: input.qty,
        date: input.event_date,
        mode: 'direct',
        weightGrams: input.weight_grams ?? null,
      },
    });
  }

  const message =
    failures.length === 0
      ? `Created ${successes.length} plantings.`
      : successes.length === 0
        ? 'No plantings created. See errors.'
        : `Created ${successes.length} plantings. ${failures.length} failed.`;

  return { message, successes, failures };
}

export async function deletePlanting(
  id: number | string
): Promise<ActionResult<{ undoId?: number }>> {
  const correlationId = createCorrelationId();
  const supabase = await createSupabaseServerClient();
  const numericId = typeof id === 'number' ? id : parseInt(id, 10);
  if (!numericId || Number.isNaN(numericId)) {
    const error = asActionError({
      code: 'validation',
      message: 'Error: Missing Planting ID for delete.',
      fieldErrors: { id: ['Invalid planting id'] },
      correlationId,
    });
    logActionError('deletePlanting.validation', error);
    return error;
  }
  const today = new Date().toISOString().slice(0, 10);
  const { error } = await supabase.rpc('fn_remove_planting', {
    p_planting_id: numericId,
    p_event_date: today,
    p_reason: 'deleted via UI',
  });
  if (error) {
    const actionError = mapDbError(error, correlationId, 'Failed to delete planting.');
    logActionError('deletePlanting.rpc', actionError, { id: numericId });
    return actionError;
  }
  revalidatePath('/plantings');
  return asActionSuccess({ undoId: numericId }, 'Planting removed successfully.', correlationId);
}

// Lifecycle server actions for RHF FormDialog flows
export const actionTransplant = async (
  prev: PlantingFormState,
  formData: FormData
): Promise<PlantingFormState> => {
  const correlationId = createCorrelationId();
  const supabase = await createSupabaseServerClient();
  const plantingIdRaw = formData.get('planting_id');
  const bedIdRaw = formData.get('bed_id');
  const eventDate = formData.get('event_date');
  const plantingId = Number(plantingIdRaw);
  const bedId = Number(bedIdRaw);
  if (!Number.isFinite(plantingId) || !Number.isFinite(bedId) || !eventDate) {
    const fieldErrors: Record<string, string[]> = {};
    if (!Number.isFinite(plantingId)) fieldErrors.planting_id = ['Planting is required'];
    if (!Number.isFinite(bedId)) fieldErrors.bed_id = ['Bed is required'];
    if (!eventDate) fieldErrors.event_date = ['Date is required'];
    const error = asActionError({
      code: 'validation',
      message: 'Please fix the highlighted fields.',
      fieldErrors,
      correlationId,
    });
    logActionError('actionTransplant.validation', error);
    return error;
  }
  const { error } = await supabase.rpc('fn_transplant_planting', {
    p_planting_id: plantingId,
    p_bed_id: bedId,
    p_event_date: String(eventDate),
  });
  if (error) {
    const actionError = mapDbError(error, correlationId, 'Failed to record transplant.');
    logActionError('actionTransplant.rpc', actionError, { plantingId, bedId, eventDate });
    return actionError;
  }
  revalidatePath('/plantings');
  return asActionSuccess({ planting: null, undoId: null }, 'Transplant recorded.', correlationId);
};

export const actionMove = async (
  prev: PlantingFormState,
  formData: FormData
): Promise<PlantingFormState> => {
  const correlationId = createCorrelationId();
  const supabase = await createSupabaseServerClient();
  const plantingIdRaw = formData.get('planting_id');
  const bedIdRaw = formData.get('bed_id');
  const eventDate = formData.get('event_date');
  const plantingId = Number(plantingIdRaw);
  const bedId = Number(bedIdRaw);
  if (!Number.isFinite(plantingId) || !Number.isFinite(bedId) || !eventDate) {
    const fieldErrors: Record<string, string[]> = {};
    if (!Number.isFinite(plantingId)) fieldErrors.planting_id = ['Planting is required'];
    if (!Number.isFinite(bedId)) fieldErrors.bed_id = ['Bed is required'];
    if (!eventDate) fieldErrors.event_date = ['Date is required'];
    const error = asActionError({
      code: 'validation',
      message: 'Please fix the highlighted fields.',
      fieldErrors,
      correlationId,
    });
    logActionError('actionMove.validation', error);
    return error;
  }
  const { error } = await supabase.rpc('fn_move_planting', {
    p_planting_id: plantingId,
    p_bed_id: bedId,
    p_event_date: String(eventDate),
  });
  if (error) {
    const actionError = mapDbError(error, correlationId, 'Failed to record move.');
    logActionError('actionMove.rpc', actionError, { plantingId, bedId, eventDate });
    return actionError;
  }
  revalidatePath('/plantings');
  return asActionSuccess({ planting: null, undoId: null }, 'Move recorded.', correlationId);
};

export const actionHarvest = async (
  prev: PlantingFormState,
  formData: FormData
): Promise<PlantingFormState> => {
  const correlationId = createCorrelationId();
  const supabase = await createSupabaseServerClient();
  const validation = HarvestSchema.safeParse({
    planting_id: formData.get('planting_id'),
    event_date: formData.get('event_date'),
    qty_harvested: formData.get('qty_harvested'),
    weight_grams: formData.get('weight_grams'),
  });
  if (!validation.success) {
    const error = asActionError({
      code: 'validation',
      message: 'Please fix the highlighted fields.',
      fieldErrors: mapZodFieldErrors(validation.error),
      correlationId,
    });
    logActionError('actionHarvest.validation', error);
    return error;
  }
  const {
    planting_id: plantingId,
    event_date: eventDate,
    qty_harvested,
    weight_grams,
  } = validation.data;
  const { error } = await supabase.rpc('fn_harvest_planting', {
    p_planting_id: plantingId,
    p_event_date: eventDate,
    p_qty_harvested: qty_harvested ?? undefined,
    p_weight_grams: weight_grams ?? undefined,
  });
  if (error) {
    const actionError = mapDbError(error, correlationId, 'Failed to record harvest.');
    logActionError('actionHarvest.rpc', actionError, { plantingId, eventDate });
    return actionError;
  }
  revalidatePath('/plantings');
  return asActionSuccess({ planting: null, undoId: null }, 'Harvest recorded.', correlationId);
};

export const actionRemove = async (
  prev: PlantingFormState,
  formData: FormData
): Promise<PlantingFormState> => {
  const correlationId = createCorrelationId();
  const supabase = await createSupabaseServerClient();
  const validation = RemoveSchema.safeParse({
    planting_id: formData.get('planting_id'),
    event_date: formData.get('event_date'),
    reason: formData.get('reason'),
  });
  if (!validation.success) {
    const error = asActionError({
      code: 'validation',
      message: 'Please fix the highlighted fields.',
      fieldErrors: mapZodFieldErrors(validation.error),
      correlationId,
    });
    logActionError('actionRemove.validation', error);
    return error;
  }
  const { planting_id: plantingId, event_date: eventDate, reason } = validation.data;
  const { error } = await supabase.rpc('fn_remove_planting', {
    p_planting_id: plantingId,
    p_event_date: eventDate,
    p_reason: reason ?? undefined,
  });
  if (error) {
    const actionError = mapDbError(error, correlationId, 'Failed to remove planting.');
    logActionError('actionRemove.rpc', actionError, { plantingId, eventDate });
    return actionError;
  }
  revalidatePath('/plantings');
  return asActionSuccess({ undoId: plantingId }, 'Planting removed.', correlationId);
};

export async function undoRemovePlanting(
  plantingId: number
): Promise<ActionResult<{ undoId: number }>> {
  const correlationId = createCorrelationId();
  const supabase = await createSupabaseServerClient();
  if (!Number.isFinite(plantingId)) {
    const error = asActionError({
      code: 'validation',
      message: 'Invalid planting id.',
      fieldErrors: { planting_id: ['Invalid planting id'] },
      correlationId,
    });
    logActionError('undoRemovePlanting.validation', error);
    return error;
  }
  const { error } = await supabase
    .from('plantings')
    .update({ status: 'planted', ended_date: null })
    .eq('id', plantingId);
  if (error) {
    const actionError = mapDbError(error, correlationId, 'Failed to undo planting removal.');
    logActionError('undoRemovePlanting.update', actionError, { plantingId });
    return actionError;
  }
  revalidatePath('/plantings');
  return asActionSuccess({ undoId: plantingId }, 'Removal undone.', correlationId);
}

// Using shared type from src/lib/types

export async function getPlantingsWithDetails(): Promise<{
  plantings?: PlantingWithDetails[];
  error?: string;
}> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('plantings')
    .select(
      `
      *,
      crop_varieties ( name, latin_name, dtm_direct_seed_min, dtm_direct_seed_max, dtm_transplant_min, dtm_transplant_max, crops ( name ) ),
      beds ( id, length_inches, width_inches, plots ( locations ( name ) ) ),
      nurseries ( name )
    `
    )
    .order('created_at', { ascending: false });
  if (error) {
    console.error('Supabase Error fetching plantings:', error);
    return { error: `Database Error: ${error.message}` };
  }
  const plantings = (data as PlantingWithDetails[]) || [];
  // Fetch metrics view and merge
  const { data: metrics, error: metricsError } = await supabase
    .from('plantings_summary')
    .select('id, planted_qty, planted_weight_grams, harvest_qty, harvest_weight_grams');
  if (metricsError) {
    console.error('Supabase Error fetching metrics view:', metricsError);
    return { plantings };
  }
  type MetricsRow = {
    id: number;
    planted_qty: number | null;
    planted_weight_grams: number | null;
    harvest_qty: number | null;
    harvest_weight_grams: number | null;
  };
  const idToMetrics = new Map<number, MetricsRow>();
  const metricsRows: MetricsRow[] = (metrics as unknown as MetricsRow[]) || [];
  metricsRows.forEach((m) =>
    idToMetrics.set(m.id, {
      id: m.id,
      planted_qty: m.planted_qty ?? null,
      planted_weight_grams: m.planted_weight_grams ?? null,
      harvest_qty: m.harvest_qty ?? null,
      harvest_weight_grams: m.harvest_weight_grams ?? null,
    })
  );
  const merged = plantings.map((p) => {
    const m = idToMetrics.get(p.id);
    return m ? { ...p, ...m } : p;
  });
  return { plantings: merged };
}

type PlantingEventWithJoins = {
  id: number;
  planting_id: number;
  event_type: string;
  event_date: string;
  bed_id: number | null;
  nursery_id: string | null;
  qty: number | null;
  weight_grams: number | null;
  quantity_unit: string | null;
  payload: Record<string, unknown> | null;
  created_at: string;
  beds: {
    id: number;
    length_inches: number | null;
    width_inches: number | null;
    plots: { locations: { name: string } | null } | null;
  } | null;
  nurseries: { name: string } | null;
};

export async function getPlantingEvents(
  plantingId: number
): Promise<{ events?: PlantingEventWithJoins[]; error?: string }> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('planting_events')
    .select(
      `
      *,
      plantings ( crop_varieties:crop_variety_id ( dtm_direct_seed_min, dtm_direct_seed_max, dtm_transplant_min, dtm_transplant_max ) ),
      beds ( id, length_inches, width_inches, plots ( locations ( name ) ) ),
      nurseries ( name )
    `
    )
    .eq('planting_id', plantingId)
    .order('event_date', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) return { error: error.message };
  return { events: (data as unknown as PlantingEventWithJoins[]) || [] };
}

type CropVarietyForSelect = Pick<
  Tables<'crop_varieties'>,
  | 'id'
  | 'name'
  | 'latin_name'
  | 'dtm_direct_seed_min'
  | 'dtm_direct_seed_max'
  | 'dtm_transplant_min'
  | 'dtm_transplant_max'
> & { crops?: { name: string } | null };

export async function getCropVarietiesForSelect(): Promise<{
  varieties?: CropVarietyForSelect[];
  error?: string;
}> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('crop_varieties')
    .select(
      'id, name, latin_name, dtm_direct_seed_min, dtm_direct_seed_max, dtm_transplant_min, dtm_transplant_max, crops(name)'
    )
    .order('name', { ascending: true });
  if (error) return { error: error.message };
  const rows = (data as unknown as CropVarietyForSelect[]) || [];
  // Ensure newly created varieties from seeds are included immediately (no filter)
  return { varieties: rows };
}

// Lifecycle actions (RPC)
export async function createNurseryPlanting(input: {
  crop_variety_id: number;
  qty: number;
  nursery_id: string;
  event_date: string;
  notes?: string;
}) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc('fn_create_nursery_planting', {
    p_crop_variety_id: input.crop_variety_id,
    p_qty: input.qty,
    p_nursery_id: input.nursery_id,
    p_event_date: input.event_date,
    p_notes: input.notes ?? undefined,
  } as unknown as Database['public']['Functions']['fn_create_nursery_planting']['Args']);
  if (error) return { error: error.message };
  revalidatePath('/plantings');
  return { ok: true };
}

export async function createDirectSeedPlanting(input: {
  crop_variety_id: number;
  qty: number;
  bed_id: number;
  event_date: string;
  notes?: string;
}) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc('fn_create_direct_seed_planting', {
    p_crop_variety_id: input.crop_variety_id,
    p_qty: input.qty,
    p_bed_id: input.bed_id,
    p_event_date: input.event_date,
    p_notes: input.notes ?? undefined,
  } as unknown as Database['public']['Functions']['fn_create_direct_seed_planting']['Args']);
  if (error) return { error: error.message };
  revalidatePath('/plantings');
  return { ok: true };
}

export async function transplantPlanting(input: {
  planting_id: number;
  bed_id: number;
  event_date: string;
}) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc('fn_transplant_planting', {
    p_planting_id: input.planting_id,
    p_bed_id: input.bed_id,
    p_event_date: input.event_date,
  });
  if (error) return { error: error.message };
  revalidatePath('/plantings');
  return { ok: true };
}

export async function movePlanting(input: {
  planting_id: number;
  bed_id: number;
  event_date: string;
}) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc('fn_move_planting', {
    p_planting_id: input.planting_id,
    p_bed_id: input.bed_id,
    p_event_date: input.event_date,
  });
  if (error) return { error: error.message };
  revalidatePath('/plantings');
  return { ok: true };
}

export async function harvestPlanting(input: {
  planting_id: number;
  event_date: string;
  qty_harvested?: number | null;
  weight_grams?: number | null;
}) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc('fn_harvest_planting', {
    p_planting_id: input.planting_id,
    p_event_date: input.event_date,
    p_qty_harvested: input.qty_harvested ?? undefined,
    p_weight_grams: input.weight_grams ?? undefined,
  });
  if (error) return { error: error.message };
  revalidatePath('/plantings');
  return { ok: true };
}

// Allow correcting status if harvested was selected incorrectly
export async function markPlantingAsPlanted(
  formData: FormData
): Promise<{ ok: true } | { error: string }> {
  const supabase = await createSupabaseServerClient();
  const plantingIdRaw = formData.get('planting_id');
  const plantingId = Number(plantingIdRaw);
  if (!Number.isFinite(plantingId)) {
    return { error: 'Error: Missing or invalid Planting ID.' };
  }
  const { error } = await supabase
    .from('plantings')
    .update({ status: 'planted', ended_date: null })
    .eq('id', plantingId);
  if (error) {
    return { error: `Database Error: ${error.message}` };
  }
  revalidatePath('/plantings');
  return { ok: true };
}

type BedForSelect = Pick<Tables<'beds'>, 'id' | 'length_inches' | 'width_inches'> & {
  plots?: { locations: { name: string } | null } | null;
};

export async function getBedsForSelect(): Promise<{ beds?: BedForSelect[]; error?: string }> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('beds')
    .select('id, length_inches, width_inches, plots(locations(name))')
    .order('id', { ascending: true });
  if (error) return { error: error.message };
  return { beds: (data as unknown as BedForSelect[]) || [] };
}

type NurseryForSelect = Pick<Tables<'nurseries'>, 'id'> & { name: string };

export async function getNurseriesForSelect(): Promise<{
  nurseries?: NurseryForSelect[];
  error?: string;
}> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('nurseries')
    .select('id, name')
    .order('name', { ascending: true });
  if (error) return { error: error.message };
  return { nurseries: (data as unknown as NurseryForSelect[]) || [] };
}

type TemplateSaveResponse = { ok: true; prefs: PlantingPrefs } | { ok: false; error: string };

export async function savePlantingTemplateAction(input: {
  name: string;
  payload: PlantingDefaults;
  overwrite?: boolean;
}): Promise<TemplateSaveResponse> {
  const result = await savePlantingTemplate({
    name: input.name,
    payload: input.payload,
    overwrite: input.overwrite,
  });
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, prefs: result.prefs };
}

export async function deletePlantingTemplateAction(
  templateId: string
): Promise<TemplateSaveResponse> {
  const result = await deletePlantingTemplate(templateId);
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, prefs: result.prefs };
}
