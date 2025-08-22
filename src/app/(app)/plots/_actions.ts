'use server';

import { createSupabaseServerClient, type Database, type Tables } from '@/lib/supabase-server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

// ----------------- PLOTS -----------------
const PlotSchema = z.object({
  plot_id: z.number().int().optional(),
  location: z.string().min(1, { message: 'Location is required' }),
});

type Plot = Tables<'plots'>;
type Bed = Tables<'beds'>;
type PlotInsert = Database['public']['Tables']['plots']['Insert'];
type PlotUpdate = Database['public']['Tables']['plots']['Update'];

export type PlotFormState = {
  message: string;
  errors?: Record<string, string[] | undefined>;
  plot?: Plot | null;
}

export async function createPlot(
  prevState: PlotFormState,
  formData: FormData
): Promise<PlotFormState> {
  const supabase = await createSupabaseServerClient();

  const validatedFields = PlotSchema.safeParse({
    location: formData.get('location'),
  });

  if (!validatedFields.success) {
    console.error('Validation Error:', validatedFields.error.flatten().fieldErrors);
    return {
      message: 'Validation failed. Could not create plot.',
      errors: validatedFields.error.flatten().fieldErrors,
    };
  }

  const plotData: PlotInsert = {
    location: validatedFields.data.location as string,
  };

  try {
    const { error } = await supabase.from('plots').insert(plotData);
    if (error) {
      console.error('Supabase Error:', error);
      return { message: `Database Error: ${error.message}` };
    }
    revalidatePath('/plots');
    return { message: 'Plot created successfully.', plot: null, errors: {} };
  } catch (e) {
    console.error('Unexpected Error:', e);
    return { message: 'An unexpected error occurred.' };
  }
}

export async function updatePlot(
  prevState: PlotFormState,
  formData: FormData
): Promise<PlotFormState> {
  const supabase = await createSupabaseServerClient();
  const idRaw = formData.get('plot_id') as string;
  const id = idRaw ? parseInt(idRaw, 10) : NaN;
  if (!id || Number.isNaN(id)) {
    return { message: 'Error: Missing Plot ID for update.' };
  }
  const validatedFields = PlotSchema.safeParse({
    plot_id: id,
    location: formData.get('location'),
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
    location: validatedFields.data.location,
  };
  try {
    const { error } = await supabase
      .from('plots')
      .update(plotDataToUpdate)
      .eq('plot_id', id);
    if (error) {
      console.error('Supabase Error:', error);
      return { message: `Database Error: ${error.message}`, plot: prevState.plot };
    }
    revalidatePath('/plots');
    return { message: 'Plot updated successfully.', plot: null, errors: {} };
  } catch (e) {
    console.error('Unexpected Error:', e);
    return { message: 'An unexpected error occurred.', plot: prevState.plot };
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
      console.error('Supabase Error:', error);
      return { message: `Database Error: ${error.message}` };
    }
    revalidatePath('/plots');
    return { message: 'Plot deleted successfully.' };
  } catch (e) {
    console.error('Unexpected Error:', e);
    return { message: 'An unexpected error occurred.' };
  }
}

type PlotDataWithMaybeBeds = Plot & { beds: Bed[] | null };
type PlotWithBeds = Plot & { beds: Bed[] };

export async function getPlotsWithBeds(): Promise<{ plots?: PlotWithBeds[]; error?: string }> {
  const supabase = await createSupabaseServerClient();
  try {
    const { data, error } = await supabase
      .from('plots')
      .select('*, beds(*)')
      .order('location', { ascending: true })
      .order('id', { referencedTable: 'beds', ascending: true });
    if (error) {
      console.error('Supabase Error fetching plots/beds:', error);
      return { error: `Database Error: ${error.message}` };
    }
    const plotsData = data as PlotDataWithMaybeBeds[] | null;
    const plotsWithEnsuredBeds: PlotWithBeds[] = plotsData?.map((plot: PlotDataWithMaybeBeds) => ({
      ...plot,
      beds: plot.beds || [],
    })) || [];
    return { plots: plotsWithEnsuredBeds };
  } catch (e) {
    console.error('Unexpected Error fetching plots/beds:', e);
    return { error: 'An unexpected error occurred while fetching plots and beds.' };
  }
}

// ----------------- BEDS -----------------
const BedSchema = z.object({
  id: z.number().int().optional(),
  plot_id: z.coerce.number().int({ message: 'Plot selection is required' }),
  length_inches: z.coerce.number().int().positive().optional().nullable(),
  width_inches: z.coerce.number().int().positive().optional().nullable(),
});

type BedInsert = Database['public']['Tables']['beds']['Insert'];
type BedUpdate = Database['public']['Tables']['beds']['Update'];

export type BedFormState = {
  message: string;
  errors?: Record<string, string[] | undefined>;
  bed?: Bed | null;
}

export async function createBed(
  prevState: BedFormState,
  formData: FormData
): Promise<BedFormState> {
  const supabase = await createSupabaseServerClient();
  const validatedFields = BedSchema.safeParse({
    plot_id: formData.get('plot_id'),
    length_inches: formData.get('length_inches') || null,
    width_inches: formData.get('width_inches') || null,
  });
  if (!validatedFields.success) {
    console.error('Validation Error:', validatedFields.error.flatten().fieldErrors);
    return {
      message: 'Validation failed. Could not create bed.',
      errors: validatedFields.error.flatten().fieldErrors,
    };
  }
  const bedData: BedInsert = {
    plot_id: validatedFields.data.plot_id,
    length_inches: validatedFields.data.length_inches ?? null,
    width_inches: validatedFields.data.width_inches ?? null,
  };
  try {
    const { error } = await supabase.from('beds').insert(bedData);
    if (error) {
      console.error('Supabase Error:', error);
      if (error.code === '23503') {
        return { message: 'Database Error: The selected plot does not exist.' };
      }
      return { message: `Database Error: ${error.message}` };
    }
    revalidatePath('/plots');
    return { message: 'Bed created successfully.', bed: null, errors: {} };
  } catch (e) {
    console.error('Unexpected Error:', e);
    return { message: 'An unexpected error occurred.' };
  }
}

export async function updateBed(
  prevState: BedFormState,
  formData: FormData
): Promise<BedFormState> {
  const supabase = await createSupabaseServerClient();
  const idRaw = formData.get('id') as string;
  const id = idRaw ? parseInt(idRaw, 10) : NaN;
  if (!id || Number.isNaN(id)) {
    return { message: 'Error: Missing Bed ID for update.' };
  }
  const validatedFields = BedSchema.safeParse({
    id: id,
    plot_id: formData.get('plot_id'),
    length_inches: formData.get('length_inches') || null,
    width_inches: formData.get('width_inches') || null,
  });
  if (!validatedFields.success) {
    console.error('Validation Error:', validatedFields.error.flatten().fieldErrors);
    return {
      message: 'Validation failed. Could not update bed.',
      errors: validatedFields.error.flatten().fieldErrors,
      bed: prevState.bed,
    };
  }
  const bedDataToUpdate: BedUpdate = {
    plot_id: validatedFields.data.plot_id,
    length_inches: validatedFields.data.length_inches ?? null,
    width_inches: validatedFields.data.width_inches ?? null,
  };
  try {
    const { error } = await supabase
      .from('beds')
      .update(bedDataToUpdate)
      .eq('id', id);
    if (error) {
      console.error('Supabase Error:', error);
      if (error.code === '23503') {
        return { message: 'Database Error: The selected plot does not exist.', bed: prevState.bed };
      }
      return { message: `Database Error: ${error.message}`, bed: prevState.bed };
    }
    revalidatePath('/plots');
    return { message: 'Bed updated successfully.', bed: null, errors: {} };
  } catch (e) {
    console.error('Unexpected Error:', e);
    return { message: 'An unexpected error occurred.', bed: prevState.bed };
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
      console.error('Supabase Error:', error);
      if (error.code === '23503') {
        return { message: 'Database Error: Cannot delete bed because it is currently associated with one or more crops.' };
      }
      return { message: `Database Error: ${error.message}` };
    }
    revalidatePath('/plots');
    return { message: 'Bed deleted successfully.' };
  } catch (e) {
    console.error('Unexpected Error:', e);
    return { message: 'An unexpected error occurred.' };
  }
}

export async function getBeds(): Promise<{ beds?: Bed[]; error?: string }> {
  const supabase = await createSupabaseServerClient();
  try {
    const { data, error } = await supabase
      .from('beds')
      .select('*, plots(location)')
      .order('id', { ascending: true });
    if (error) {
      console.error('Supabase Error fetching beds:', error);
      return { error: `Database Error: ${error.message}` };
    }
    return { beds: data || [] };
  } catch (e) {
    console.error('Unexpected Error fetching beds:', e);
    return { error: 'An unexpected error occurred while fetching beds.' };
  }
}