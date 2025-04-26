'use server';

import { createSupabaseServerClient, type Database, type Tables } from '@/lib/supabase-server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

// Define Zod schema for bed validation
const BedSchema = z.object({
  id: z.string().uuid().optional(),
  plot_id: z.string().uuid({ message: 'Plot selection is required' }),
  name: z.string().min(1, { message: 'Bed name is required' }),
  length_in: z.coerce.number().int().positive().optional().nullable(),
  width_in: z.coerce.number().int().positive().optional().nullable(),
});

type Bed = Tables<'beds'>;
type BedInsert = Database['public']['Tables']['beds']['Insert'];
type BedUpdate = Database['public']['Tables']['beds']['Update'];

export type BedFormState = {
  message: string;
  errors?: Record<string, string[] | undefined>;
  bed?: Bed | null;
}

// CREATE Bed
export async function createBed(
  prevState: BedFormState,
  formData: FormData
): Promise<BedFormState> {
  const supabase = createSupabaseServerClient();

  const validatedFields = BedSchema.safeParse({
    plot_id: formData.get('plot_id'),
    name: formData.get('name'),
    length_in: formData.get('length_in') || null,
    width_in: formData.get('width_in') || null,
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
       // Handle foreign key violation (e.g., invalid plot_id)
      if (error.code === '23503') {
          return { message: 'Database Error: The selected plot does not exist.' };
      }
      return { message: `Database Error: ${error.message}` };
    }

    revalidatePath('/dashboard/plots'); // Revalidate the plots page as beds are shown there
    return { message: 'Bed created successfully.', bed: null, errors: {} };

  } catch (e) {
    console.error('Unexpected Error:', e);
    return { message: 'An unexpected error occurred.' };
  }
}

// UPDATE Bed
export async function updateBed(
  prevState: BedFormState,
  formData: FormData
): Promise<BedFormState> {
  const supabase = createSupabaseServerClient();
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
  });

  if (!validatedFields.success) {
      console.error('Validation Error:', validatedFields.error.flatten().fieldErrors);
      return {
          message: 'Validation failed. Could not update bed.',
          errors: validatedFields.error.flatten().fieldErrors,
          bed: prevState.bed
      };
  }

  const { id: _, ...bedDataToUpdate }: BedUpdate = validatedFields.data;

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

    revalidatePath('/dashboard/plots');
    return { message: 'Bed updated successfully.', bed: null, errors: {} };

  } catch (e) {
    console.error('Unexpected Error:', e);
    return { message: 'An unexpected error occurred.', bed: prevState.bed };
  }
}

// DELETE Bed
export async function deleteBed(id: string): Promise<{ message: string }> {
  const supabase = createSupabaseServerClient();

  if (!id) {
    return { message: 'Error: Missing Bed ID for delete.' };
  }

  try {
    const { error } = await supabase.from('beds').delete().eq('id', id);

    if (error) {
      console.error('Supabase Error:', error);
      if (error.code === '23503') { // foreign_key_violation (likely due to crops referencing bed)
         return { message: 'Database Error: Cannot delete bed because it is currently associated with one or more crops.' };
      }
      return { message: `Database Error: ${error.message}` };
    }

    revalidatePath('/dashboard/plots');
    return { message: 'Bed deleted successfully.' };

  } catch (e) {
    console.error('Unexpected Error:', e);
    return { message: 'An unexpected error occurred.' };
  }
}

// --- Helper function to get beds (e.g., for dropdowns) ---
export async function getBeds(): Promise<{ beds?: Bed[]; error?: string }> {
  const supabase = createSupabaseServerClient();
  try {
    // Fetch beds and include plot name for context
    const { data, error } = await supabase
      .from('beds')
      .select('*, plots(name)') // Select all bed fields and the name from related plot
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