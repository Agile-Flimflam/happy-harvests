'use server';

import { createSupabaseServerClient, type Database, type Tables } from '@/lib/supabase-server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

// Define Zod schema for plot validation
const PlotSchema = z.object({
  id: z.string().uuid().optional(), // Optional for insert
  name: z.string().min(1, { message: 'Name is required' }),
  address: z.string().optional().nullable(),
});

// Use Tables type alias for cleaner definitions
type Plot = Tables<'plots'>;
type Bed = Tables<'beds'>; // Define Bed type
type PlotInsert = Database['public']['Tables']['plots']['Insert'];
type PlotUpdate = Database['public']['Tables']['plots']['Update'];

export type PlotFormState = {
  message: string;
  errors?: Record<string, string[] | undefined>;
  plot?: Plot | null;
}

// CREATE Plot
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

    revalidatePath('/dashboard/plots');
    return { message: 'Plot created successfully.', plot: null, errors: {} };

  } catch (e) {
    console.error('Unexpected Error:', e);
    return { message: 'An unexpected error occurred.' };
  }
}

// UPDATE Plot
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
          plot: prevState.plot
      };
  }

  const { id: _, ...plotDataToUpdate }: PlotUpdate = validatedFields.data;

  try {
    const { error } = await supabase
      .from('plots')
      .update(plotDataToUpdate)
      .eq('id', id);

    if (error) {
      console.error('Supabase Error:', error);
      return { message: `Database Error: ${error.message}`, plot: prevState.plot };
    }

    revalidatePath('/dashboard/plots');
    return { message: 'Plot updated successfully.', plot: null, errors: {} };

  } catch (e) {
    console.error('Unexpected Error:', e);
    return { message: 'An unexpected error occurred.', plot: prevState.plot };
  }
}

// DELETE Plot
export async function deletePlot(id: string): Promise<{ message: string }> {
  const supabase = await createSupabaseServerClient();

  if (!id) {
    return { message: 'Error: Missing Plot ID for delete.' };
  }

  try {
    // Note: Deleting a plot will cascade delete associated beds due to schema constraint
    const { error } = await supabase.from('plots').delete().eq('id', id);

    if (error) {
      console.error('Supabase Error:', error);
      // Cascade delete handles bed deletion, but crops might still reference beds within this plot.
      // A more robust check might be needed depending on desired behavior (e.g., prevent deleting plots with active crops).
      return { message: `Database Error: ${error.message}` };
    }

    revalidatePath('/dashboard/plots');
    return { message: 'Plot deleted successfully.' };

  } catch (e) {
    console.error('Unexpected Error:', e);
    return { message: 'An unexpected error occurred.' };
  }
}

// --- Helper function to get plots (and their beds) ---
// Define the expected shape from the Supabase query
// Adjust based on actual generated types if necessary
type PlotDataWithMaybeBeds = Plot & {
  beds: Bed[] | null; // Supabase might return null for the relation
};

// Define the final desired shape
type PlotWithBeds = Plot & {
  beds: Bed[];
};

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

    // Type the data from Supabase explicitly
    const plotsData = data as PlotDataWithMaybeBeds[] | null;

    // Ensure beds is always an array
    const plotsWithEnsuredBeds: PlotWithBeds[] = plotsData?.map((plot: PlotDataWithMaybeBeds) => ({
        ...plot,
        beds: plot.beds || [], // Replace null with empty array
    })) || [];

    return { plots: plotsWithEnsuredBeds };

  } catch (e) {
     console.error('Unexpected Error fetching plots/beds:', e);
     return { error: 'An unexpected error occurred while fetching plots and beds.' };
  }
} 