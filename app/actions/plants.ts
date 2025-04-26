'use server';

import { createSupabaseServerClient, type Database } from '@/lib/supabase-server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

// Define Zod schema for plant validation
const PlantSchema = z.object({
  id: z.string().uuid().optional(), // Optional for insert
  name: z.string().min(1, { message: 'Name is required' }),
  variety: z.string().optional().nullable(),
  latin_name: z.string().optional().nullable(),
  is_organic: z.boolean().default(false),
  avg_days_to_maturity: z.coerce.number().int().positive().optional().nullable(), // Coerce to number
});

type Plant = Database['public']['Tables']['plants']['Row'];
type PlantInsert = Database['public']['Tables']['plants']['Insert'];
type PlantUpdate = Database['public']['Tables']['plants']['Update'];

export type PlantFormState = {
  message: string;
  errors?: Record<string, string[] | undefined>;
  plant?: Plant | null;
}

// CREATE Plant
export async function createPlant(
  prevState: PlantFormState,
  formData: FormData
): Promise<PlantFormState> {
  const supabase = createSupabaseServerClient();

  const validatedFields = PlantSchema.safeParse({
    name: formData.get('name'),
    variety: formData.get('variety') || null,
    latin_name: formData.get('latin_name') || null,
    is_organic: formData.get('is_organic') === 'on', // Checkbox value
    avg_days_to_maturity: formData.get('avg_days_to_maturity') || null,
  });

  // If form validation fails, return errors early.
  if (!validatedFields.success) {
    console.error('Validation Error:', validatedFields.error.flatten().fieldErrors);
    return {
      message: 'Validation failed. Could not create plant.',
      errors: validatedFields.error.flatten().fieldErrors,
    };
  }

  const plantData: PlantInsert = validatedFields.data;

  try {
    const { error } = await supabase.from('plants').insert(plantData);

    if (error) {
      console.error('Supabase Error:', error);
      return { message: `Database Error: ${error.message}` };
    }

    revalidatePath('/dashboard/plants'); // Revalidate cache for the plants page
    return { message: 'Plant created successfully.', plant: null, errors: {} }; // Reset form state

  } catch (e) {
    console.error('Unexpected Error:', e);
    return { message: 'An unexpected error occurred.' };
  }
}

// UPDATE Plant
export async function updatePlant(
  prevState: PlantFormState,
  formData: FormData
): Promise<PlantFormState> {
    const supabase = createSupabaseServerClient();
    const id = formData.get('id') as string;

    if (!id) {
      return { message: 'Error: Missing Plant ID for update.' };
    }

    const validatedFields = PlantSchema.safeParse({
      id: id, // Include ID for context, though it's used directly
      name: formData.get('name'),
      variety: formData.get('variety') || null,
      latin_name: formData.get('latin_name') || null,
      is_organic: formData.get('is_organic') === 'on',
      avg_days_to_maturity: formData.get('avg_days_to_maturity') || null,
    });

    if (!validatedFields.success) {
        console.error('Validation Error:', validatedFields.error.flatten().fieldErrors);
        return {
            message: 'Validation failed. Could not update plant.',
            errors: validatedFields.error.flatten().fieldErrors,
            plant: prevState.plant // Keep existing plant data in form if validation fails
        };
    }

    // Don't try to update the ID itself
    // Destructure validated data, excluding the id field
    const { id: _, ...plantDataToUpdate }: PlantUpdate = validatedFields.data;

    try {
        const { error } = await supabase
            .from('plants')
            .update(plantDataToUpdate)
            .eq('id', id);

        if (error) {
            console.error('Supabase Error:', error);
            return { message: `Database Error: ${error.message}`, plant: prevState.plant };
        }

        revalidatePath('/dashboard/plants');
        return { message: 'Plant updated successfully.', plant: null, errors: {} }; // Clear form on success

    } catch (e) {
        console.error('Unexpected Error:', e);
        return { message: 'An unexpected error occurred.', plant: prevState.plant };
    }
}

// DELETE Plant
export async function deletePlant(id: string): Promise<{ message: string }> {
  const supabase = createSupabaseServerClient();

  if (!id) {
    return { message: 'Error: Missing Plant ID for delete.' };
  }

  try {
    const { error } = await supabase.from('plants').delete().eq('id', id);

    if (error) {
      console.error('Supabase Error:', error);
      // Handle potential foreign key constraint errors (e.g., if plant is used in crops)
      if (error.code === '23503') { // foreign_key_violation
         return { message: 'Database Error: Cannot delete plant because it is currently associated with one or more crops.' };
      }
      return { message: `Database Error: ${error.message}` };
    }

    revalidatePath('/dashboard/plants');
    return { message: 'Plant deleted successfully.' };

  } catch (e) {
    console.error('Unexpected Error:', e);
    return { message: 'An unexpected error occurred.' };
  }
}

// --- Helper function to get plants (can be used in server components) ---
export async function getPlants(): Promise<{ plants?: Plant[]; error?: string }> {
  const supabase = createSupabaseServerClient();
  try {
    const { data, error } = await supabase
      .from('plants')
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      console.error('Supabase Error fetching plants:', error);
      return { error: `Database Error: ${error.message}` };
    }
    return { plants: data || [] };
  } catch (e) {
     console.error('Unexpected Error fetching plants:', e);
     return { error: 'An unexpected error occurred while fetching plants.' };
  }
} 