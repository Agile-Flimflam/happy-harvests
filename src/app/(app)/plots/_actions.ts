'use server';

import { createSupabaseServerClient, type Database, type Tables } from '@/lib/supabase-server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

// ----------------- PLOTS -----------------
const PlotSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1, { message: 'Name is required' }),
  address: z.string().optional().nullable(),
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
    name: formData.get('name'),
    address: formData.get('address') || null,
  });

  if (!validatedFields.success) {
    console.error('Validation Error:', validatedFields.error.flatten().fieldErrors);
    return {
      message: 'Validation failed. Could not create plot.',
      errors: validatedFields.error.flatten().fieldErrors,
    };
  }

  const plotData: PlotInsert = validatedFields.data;

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
  const id = formData.get('id') as string;
  if (!id) {
    return { message: 'Error: Missing Plot ID for update.' };
  }
  const validatedFields = PlotSchema.safeParse({
    id: id,
    name: formData.get('name'),
    address: formData.get('address') || null,
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
    address: validatedFields.data.address ?? null,
  };
  try {
    const { error } = await supabase
      .from('plots')
      .update(plotDataToUpdate)
      .eq('id', id);
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

export async function deletePlot(id: string): Promise<{ message: string }> {
  const supabase = await createSupabaseServerClient();
  if (!id) {
    return { message: 'Error: Missing Plot ID for delete.' };
  }
  try {
    const { error } = await supabase.from('plots').delete().eq('id', id);
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
      .order('name', { ascending: true })
      .order('name', { referencedTable: 'beds', ascending: true });
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
  id: z.string().uuid().optional(),
  plot_id: z.string().uuid({ message: 'Plot selection is required' }),
  name: z.string().min(1, { message: 'Bed name is required' }),
  length_in: z.coerce.number().int().positive().optional().nullable(),
  width_in: z.coerce.number().int().positive().optional().nullable(),
  notes: z.string().optional().nullable(),
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
    name: formData.get('name'),
    length_in: formData.get('length_in') || null,
    width_in: formData.get('width_in') || null,
    notes: formData.get('notes') || null,
  });
  if (!validatedFields.success) {
    console.error('Validation Error:', validatedFields.error.flatten().fieldErrors);
    return {
      message: 'Validation failed. Could not create bed.',
      errors: validatedFields.error.flatten().fieldErrors,
    };
  }
  const bedData: BedInsert = validatedFields.data;
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
  const id = formData.get('id') as string;
  if (!id) {
    return { message: 'Error: Missing Bed ID for update.' };
  }
  const validatedFields = BedSchema.safeParse({
    id: id,
    plot_id: formData.get('plot_id'),
    name: formData.get('name'),
    length_in: formData.get('length_in') || null,
    width_in: formData.get('width_in') || null,
    notes: formData.get('notes') || null,
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
    name: validatedFields.data.name,
    length_in: validatedFields.data.length_in ?? null,
    width_in: validatedFields.data.width_in ?? null,
    notes: validatedFields.data.notes ?? null,
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

export async function deleteBed(id: string): Promise<{ message: string }> {
  const supabase = await createSupabaseServerClient();
  if (!id) {
    return { message: 'Error: Missing Bed ID for delete.' };
  }
  try {
    const { error } = await supabase.from('beds').delete().eq('id', id);
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
      .select('*, plots(name)')
      .order('name', { ascending: true });
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