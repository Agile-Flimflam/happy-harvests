'use server';

import { createSupabaseServerClient } from '@/lib/supabase-server';
import type { Database, Tables } from '@/lib/database.types';
import { revalidatePath } from 'next/cache';
import { PlotSchema, BedSchema, BulkPlotSchema, BulkBedSchema } from '@/lib/validation/plots';
import { rememberBedSize, rememberLastLocation, rememberLastPlot } from '@/lib/quick-create-prefs';

// ----------------- PLOTS -----------------

type Plot = Tables<'plots'>;
type Bed = Tables<'beds'>;
type Location = Tables<'locations'>;
type PlotInsert = Database['public']['Tables']['plots']['Insert'];
type PlotUpdate = Database['public']['Tables']['plots']['Update'];
type BedWithPlotLocation = Bed & {
  plots: { name: string | null; location_id: string | null } | null;
};

function toPlotLocation(
  value: unknown
): { name: string | null; location_id: string | null } | null {
  if (!value || typeof value !== 'object') return null;
  const maybe = value as { name?: unknown; location_id?: unknown };
  const name = typeof maybe.name === 'string' ? maybe.name : null;
  const location_id = typeof maybe.location_id === 'string' ? maybe.location_id : null;
  return { name, location_id };
}

function dbErrorMessage(context: string, error: unknown): string {
  console.error(`[Plots] ${context}`, error);
  return 'Database error. Please try again.';
}

export type PlotFormState = {
  message: string;
  errors?: Record<string, string | string[] | undefined>;
  plot?: Plot | null;
};

export type BulkPlotFormState = {
  message: string;
  errors?: Record<string, string | string[] | undefined>;
  createdCount?: number;
  skipped?: string[];
};

function numberFromFormValue(v: FormDataEntryValue | null): number | undefined {
  if (typeof v !== 'string') return undefined;
  const n = Number(v.trim());
  return Number.isFinite(n) ? n : undefined;
}

function stringFromFormValue(v: FormDataEntryValue | null): string | undefined {
  if (typeof v !== 'string') return undefined;
  const trimmed = v.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function numberOrNullFromFormValue(v: FormDataEntryValue | null): number | null | undefined {
  if (v === null) return null;
  if (typeof v !== 'string') return undefined;
  const trimmed = v.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : undefined;
}

export async function createPlot(
  prevState: PlotFormState,
  formData: FormData
): Promise<PlotFormState> {
  const supabase = await createSupabaseServerClient();

  const validatedFields = PlotSchema.safeParse({
    name: formData.get('name'),
    location_id: stringFromFormValue(formData.get('location_id')),
  });

  if (!validatedFields.success) {
    console.error('Validation Error:', validatedFields.error.flatten().fieldErrors);
    return {
      message: 'Validation failed. Could not create plot.',
      errors: validatedFields.error.flatten().fieldErrors,
    };
  }

  const plotData: PlotInsert = {
    name: validatedFields.data.name,
    location_id: validatedFields.data.location_id,
  };

  try {
    const { data, error } = await supabase
      .from('plots')
      .insert(plotData)
      .select('plot_id, location_id')
      .single();
    if (error) {
      return { message: dbErrorMessage('createPlot', error) };
    }
    if (data?.location_id) {
      await rememberLastLocation(data.location_id);
    }
    if (data?.plot_id) {
      await rememberLastPlot(data.plot_id);
    }
    revalidatePath('/plots');
    return { message: 'Plot created successfully.', plot: null, errors: {} };
  } catch (e) {
    return { message: dbErrorMessage('createPlot unexpected', e) };
  }
}

export async function updatePlot(
  prevState: PlotFormState,
  formData: FormData
): Promise<PlotFormState> {
  const supabase = await createSupabaseServerClient();
  const plotIdValue = formData.get('plot_id');
  const id =
    typeof plotIdValue === 'string' && plotIdValue.trim() !== '' ? parseInt(plotIdValue, 10) : NaN;
  if (!id || Number.isNaN(id)) {
    return { message: 'Error: Missing Plot ID for update.' };
  }
  const validatedFields = PlotSchema.safeParse({
    name: formData.get('name'),
    location_id: stringFromFormValue(formData.get('location_id')),
  });
  if (!validatedFields.success) {
    console.error('Validation Error:', validatedFields.error.flatten().fieldErrors);
    return {
      message: 'Validation failed. Could not update plot.',
      errors: validatedFields.error.flatten().fieldErrors,
      plot: prevState.plot,
    };
  }
  const plotDataToUpdate: PlotUpdate = {
    name: validatedFields.data.name,
    location_id: validatedFields.data.location_id,
  };
  try {
    const { error } = await supabase.from('plots').update(plotDataToUpdate).eq('plot_id', id);
    if (error) {
      return { message: dbErrorMessage('updatePlot', error), plot: prevState.plot };
    }
    revalidatePath('/plots');
    if (validatedFields.data.location_id) {
      await rememberLastLocation(validatedFields.data.location_id);
    }
    return { message: 'Plot updated successfully.', plot: null, errors: {} };
  } catch (e) {
    return { message: dbErrorMessage('updatePlot unexpected', e), plot: prevState.plot };
  }
}

export async function getLocationsList(): Promise<{ locations?: Location[]; error?: string }> {
  const supabase = await createSupabaseServerClient();
  try {
    const { data, error } = await supabase
      .from('locations')
      .select('*')
      .order('name', { ascending: true });
    if (error) {
      return { error: dbErrorMessage('getLocationsList', error) };
    }
    return { locations: data ?? [] };
  } catch (e) {
    return { error: dbErrorMessage('getLocationsList unexpected', e) };
  }
}

export async function deletePlot(id: string | number): Promise<{ message: string }> {
  const supabase = await createSupabaseServerClient();
  const numericId = typeof id === 'number' ? id : parseInt(id, 10);
  if (!numericId || Number.isNaN(numericId)) {
    return { message: 'Error: Missing Plot ID for delete.' };
  }
  try {
    const { error } = await supabase.from('plots').delete().eq('plot_id', numericId);
    if (error) {
      return { message: dbErrorMessage('deletePlot', error) };
    }
    revalidatePath('/plots');
    return { message: 'Plot deleted successfully.' };
  } catch (e) {
    return { message: dbErrorMessage('deletePlot unexpected', e) };
  }
}

// Helper function to calculate plot acreage from beds
const calculatePlotAcreage = (beds: Bed[]): number => {
  const totalSqFt = beds.reduce((sum, bed) => {
    const length = bed.length_inches;
    const width = bed.width_inches;
    if (length && width && length > 0 && width > 0) {
      return sum + (length * width) / 144;
    }
    return sum;
  }, 0);
  return totalSqFt / 43560;
};

type PlotDataWithMaybeBeds = Plot & { beds: Bed[] | null; locations: Location | null };
type PlotWithBeds = Plot & { beds: Bed[]; locations: Location | null; totalAcreage: number };

export async function getPlotsWithBeds(): Promise<{ plots?: PlotWithBeds[]; error?: string }> {
  const supabase = await createSupabaseServerClient();
  try {
    const { data, error } = await supabase
      .from('plots')
      .select('*, beds(*), locations(*)')
      .order('name', { ascending: true })
      .order('id', { referencedTable: 'beds', ascending: true });
    if (error) {
      console.error('Supabase Error fetching plots/beds:', error);
      return { error: `Database Error: ${error.message}` };
    }
    const plotsData: PlotDataWithMaybeBeds[] = data ?? [];
    const plotsWithEnsuredBeds: PlotWithBeds[] = plotsData.map((plot) => ({
      ...plot,
      beds: plot.beds || [],
      locations: plot.locations || null,
      totalAcreage: calculatePlotAcreage(plot.beds || []),
    }));
    return { plots: plotsWithEnsuredBeds };
  } catch (e) {
    console.error('Unexpected Error fetching plots/beds:', e);
    return { error: 'An unexpected error occurred while fetching plots and beds.' };
  }
}

// ----------------- BEDS -----------------

type BedInsert = Database['public']['Tables']['beds']['Insert'];
type BedUpdate = Database['public']['Tables']['beds']['Update'];

export type BedFormState = {
  message: string;
  errors?: Record<string, string[] | undefined>;
  bed?: Bed | null;
};

type BedSizeErrors = {
  length_inches?: string | string[];
  width_inches?: string | string[];
};

type BulkBedErrors = Record<string, string | string[] | undefined> & {
  size?: BedSizeErrors | string[];
};

export type BulkBedFormState = {
  message: string;
  errors?: BulkBedErrors;
  createdCount?: number;
  skipped?: string[];
};

export async function createBed(
  prevState: BedFormState,
  formData: FormData
): Promise<BedFormState> {
  const supabase = await createSupabaseServerClient();
  const validatedFields = BedSchema.safeParse({
    plot_id: numberFromFormValue(formData.get('plot_id')),
    length_inches: numberOrNullFromFormValue(formData.get('length_inches')),
    width_inches: numberOrNullFromFormValue(formData.get('width_inches')),
  });
  if (!validatedFields.success) {
    console.error('Validation Error:', validatedFields.error.flatten().fieldErrors);
    return {
      message: 'Validation failed. Could not create bed.',
      errors: validatedFields.error.flatten().fieldErrors,
    };
  }
  const bedNameValue = formData.get('name');
  const bedName = typeof bedNameValue === 'string' ? bedNameValue : null;
  const bedData: BedInsert = {
    plot_id: validatedFields.data.plot_id,
    length_inches: validatedFields.data.length_inches ?? null,
    width_inches: validatedFields.data.width_inches ?? null,
    name: bedName,
  };
  try {
    const { data, error } = await supabase
      .from('beds')
      .insert(bedData)
      .select('id, plot_id, length_inches, width_inches')
      .single();
    if (error) {
      if (error.code === '23503') {
        return { message: 'Database Error: The selected plot does not exist.' };
      }
      return { message: dbErrorMessage('createBed', error) };
    }
    if (bedData.length_inches && bedData.width_inches) {
      await rememberBedSize({
        lengthInches: bedData.length_inches,
        widthInches: bedData.width_inches,
      });
    }
    if (data?.plot_id) {
      const { data: plotRow } = await supabase
        .from('plots')
        .select('location_id')
        .eq('plot_id', data.plot_id)
        .single();
      if (plotRow?.location_id) {
        await rememberLastLocation(plotRow.location_id);
      }
    }
    revalidatePath('/plots');
    return { message: 'Bed created successfully.', bed: null, errors: {} };
  } catch (e) {
    return { message: dbErrorMessage('createBed unexpected', e) };
  }
}

export async function updateBed(
  prevState: BedFormState,
  formData: FormData
): Promise<BedFormState> {
  const supabase = await createSupabaseServerClient();
  const idValue = formData.get('id');
  const id = typeof idValue === 'string' && idValue.trim() !== '' ? parseInt(idValue, 10) : NaN;
  if (!id || Number.isNaN(id)) {
    return { message: 'Error: Missing Bed ID for update.' };
  }
  const validatedFields = BedSchema.safeParse({
    plot_id: numberFromFormValue(formData.get('plot_id')),
    length_inches: numberOrNullFromFormValue(formData.get('length_inches')),
    width_inches: numberOrNullFromFormValue(formData.get('width_inches')),
  });
  if (!validatedFields.success) {
    console.error('Validation Error:', validatedFields.error.flatten().fieldErrors);
    return {
      message: 'Validation failed. Could not update bed.',
      errors: validatedFields.error.flatten().fieldErrors,
      bed: prevState.bed,
    };
  }
  const updateNameValue = formData.get('name');
  const updateName =
    typeof updateNameValue === 'string'
      ? updateNameValue
      : updateNameValue === null
        ? null
        : undefined;
  const bedDataToUpdate: BedUpdate = {
    plot_id: validatedFields.data.plot_id,
    length_inches: validatedFields.data.length_inches ?? null,
    width_inches: validatedFields.data.width_inches ?? null,
    name: updateName,
  };
  try {
    const { error } = await supabase.from('beds').update(bedDataToUpdate).eq('id', id);
    if (error) {
      if (error.code === '23503') {
        return { message: 'Database Error: The selected plot does not exist.', bed: prevState.bed };
      }
      return { message: dbErrorMessage('updateBed', error), bed: prevState.bed };
    }
    if (bedDataToUpdate.length_inches && bedDataToUpdate.width_inches) {
      await rememberBedSize({
        lengthInches: bedDataToUpdate.length_inches,
        widthInches: bedDataToUpdate.width_inches,
      });
    }
    revalidatePath('/plots');
    return { message: 'Bed updated successfully.', bed: null, errors: {} };
  } catch (e) {
    return { message: dbErrorMessage('updateBed unexpected', e), bed: prevState.bed };
  }
}

export async function deleteBed(id: string | number): Promise<{ message: string }> {
  const supabase = await createSupabaseServerClient();
  const numericId = typeof id === 'string' ? parseInt(id, 10) : id;
  if (!numericId || Number.isNaN(numericId)) {
    return { message: 'Error: Missing or invalid Bed ID for delete.' };
  }
  try {
    const { error } = await supabase.from('beds').delete().eq('id', numericId);
    if (error) {
      if (error.code === '23503') {
        return {
          message:
            'Database Error: Cannot delete bed because it is currently associated with one or more crops.',
        };
      }
      return { message: dbErrorMessage('deleteBed', error) };
    }
    revalidatePath('/plots');
    return { message: 'Bed deleted successfully.' };
  } catch (e) {
    return { message: dbErrorMessage('deleteBed unexpected', e) };
  }
}

export async function getBeds(): Promise<{ beds?: BedWithPlotLocation[]; error?: string }> {
  const supabase = await createSupabaseServerClient();
  try {
    const { data, error } = await supabase
      .from('beds')
      .select('*, plots(name,location_id)')
      .order('id', { ascending: true })
      .returns<BedWithPlotLocation[]>();
    if (error) {
      return { error: dbErrorMessage('getBeds', error) };
    }
    const rawRows: BedWithPlotLocation[] = data ?? [];
    const beds: BedWithPlotLocation[] = rawRows.map((row) => {
      const plots = toPlotLocation(row?.plots);
      return { ...row, plots };
    });
    return { beds };
  } catch (e) {
    console.error('Unexpected Error fetching beds:', e);
    return { error: 'An unexpected error occurred while fetching beds.' };
  }
}

const normalizeName = (value: string | null | undefined): string =>
  (value ?? '').trim().toLowerCase();

export async function bulkCreatePlots(
  prev: BulkPlotFormState,
  formData: FormData
): Promise<BulkPlotFormState> {
  const supabase = await createSupabaseServerClient();
  const validated = BulkPlotSchema.safeParse({
    location_id: stringFromFormValue(formData.get('location_id')),
    base_name: stringFromFormValue(formData.get('base_name')),
    count: numberFromFormValue(formData.get('count')),
  });
  if (!validated.success) {
    return {
      message: 'Validation failed. Could not create plots.',
      errors: validated.error.flatten().fieldErrors,
    };
  }

  const { location_id, base_name, count } = validated.data;
  const baseName = base_name ?? '';
  if (!baseName) {
    return {
      message: 'Name prefix is required.',
      errors: { base_name: 'Name prefix is required' },
    };
  }

  const { data: existing, error: existingError } = await supabase
    .from('plots')
    .select('name, plot_id')
    .eq('location_id', location_id);
  if (existingError) {
    return { message: dbErrorMessage('bulkCreatePlots existing', existingError) };
  }

  const existingNames = new Set(existing?.map((row) => normalizeName(row.name)) ?? []);
  const payload: PlotInsert[] = [];
  const skipped: string[] = [];

  for (let index = 0; index < count; index += 1) {
    const candidate = `${baseName} ${index + 1}`;
    const normalized = normalizeName(candidate);
    if (existingNames.has(normalized)) {
      skipped.push(candidate);
      continue;
    }
    existingNames.add(normalized);
    payload.push({
      name: candidate,
      location_id,
    });
  }

  if (payload.length === 0) {
    return {
      message: 'No plots created; all names already exist for this location.',
      skipped,
      errors: { duplicates: 'All names would duplicate existing plots' },
    };
  }

  const { data: inserted, error } = await supabase.from('plots').insert(payload).select('plot_id');
  if (error) {
    return { message: dbErrorMessage('bulkCreatePlots insert', error) };
  }
  await rememberLastLocation(location_id);
  if (inserted && inserted.length > 0) {
    await rememberLastPlot(inserted[inserted.length - 1].plot_id);
  }
  revalidatePath('/plots');
  return {
    message: `Created ${payload.length} plot${payload.length === 1 ? '' : 's'}.`,
    createdCount: payload.length,
    skipped,
  };
}

export async function bulkCreateBeds(
  prev: BulkBedFormState,
  formData: FormData
): Promise<BulkBedFormState> {
  const supabase = await createSupabaseServerClient();
  const validated = BulkBedSchema.safeParse({
    location_id: stringFromFormValue(formData.get('location_id')),
    plot_id: numberFromFormValue(formData.get('plot_id')),
    base_name: stringFromFormValue(formData.get('base_name')),
    count: numberFromFormValue(formData.get('count')),
    unit: formData.get('unit'),
    size: {
      length_inches: numberFromFormValue(formData.get('length_inches')),
      width_inches: numberFromFormValue(formData.get('width_inches')),
    },
  });
  if (!validated.success) {
    return {
      message: 'Validation failed. Could not create beds.',
      errors: validated.error.flatten().fieldErrors,
    };
  }

  if (validated.data.unit !== 'in') {
    return {
      message: 'Units must match (inches only).',
      errors: { units: 'Only inches are supported for bulk create' },
    };
  }

  const { plot_id, location_id, base_name, count } = validated.data;
  const { length_inches, width_inches } = validated.data.size;

  const { data: existing, error: existingError } = await supabase
    .from('beds')
    .select('name')
    .eq('plot_id', plot_id);
  if (existingError) {
    return { message: dbErrorMessage('bulkCreateBeds existing', existingError) };
  }

  const existingNames = new Set(existing?.map((row) => normalizeName(row.name)) ?? []);
  const payload: BedInsert[] = [];
  const skipped: string[] = [];
  const prefix = base_name && base_name.trim().length > 0 ? base_name.trim() : 'Bed';

  for (let index = 0; index < count; index += 1) {
    const candidate = `${prefix} ${existingNames.size + index + 1}`;
    const normalized = normalizeName(candidate);
    if (existingNames.has(normalized)) {
      skipped.push(candidate);
      continue;
    }
    existingNames.add(normalized);
    payload.push({
      plot_id,
      name: candidate,
      length_inches,
      width_inches,
    });
  }

  if (payload.length === 0) {
    return {
      message: 'No beds created; all names already exist for this plot.',
      skipped,
      errors: { duplicates: 'All names would duplicate existing beds' },
    };
  }

  const { error } = await supabase.from('beds').insert(payload);
  if (error) {
    return { message: dbErrorMessage('bulkCreateBeds insert', error) };
  }

  await rememberBedSize({ lengthInches: length_inches, widthInches: width_inches });
  if (location_id) {
    await rememberLastLocation(location_id);
  } else {
    const { data: plotRow } = await supabase
      .from('plots')
      .select('location_id')
      .eq('plot_id', plot_id)
      .single();
    if (plotRow?.location_id) {
      await rememberLastLocation(plotRow.location_id);
    }
  }
  await rememberLastPlot(plot_id);

  revalidatePath('/plots');
  return {
    message: `Created ${payload.length} bed${payload.length === 1 ? '' : 's'}.`,
    createdCount: payload.length,
    skipped,
  };
}
