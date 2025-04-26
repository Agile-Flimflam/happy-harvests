'use server';

import { createSupabaseServerClient, type Database, type Tables, type Enums } from '@/lib/supabase-server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

// Define Zod schema for crop validation
const CropStatusEnum = z.enum(['planned', 'planted', 'growing', 'harvested']);

const CropSchema = z.object({
  id: z.string().uuid().optional(),
  plant_id: z.string().uuid({ message: 'Plant selection is required' }),
  bed_id: z.string().uuid({ message: 'Bed selection is required' }),
  row_spacing_cm: z.coerce.number().int().positive().optional().nullable(),
  seed_spacing_cm: z.coerce.number().int().positive().optional().nullable(),
  planted_date: z.coerce.date().optional().nullable(),
  harvested_date: z.coerce.date().optional().nullable(),
  status: CropStatusEnum.default('planned'),
});

type Crop = Tables<'crops'>;
type CropInsert = Database['public']['Tables']['crops']['Insert'];
type CropUpdate = Database['public']['Tables']['crops']['Update'];
export type CropStatus = Enums<'crop_status'>; // Export enum type

export type CropFormState = {
  message: string;
  errors?: Record<string, string[] | undefined>;
  crop?: Crop | null;
}

// Helper to format date for input[type=date]
function formatDateForInput(date: Date | null | undefined): string {
    return date ? date.toISOString().split('T')[0] : '';
}

// CREATE Crop
export async function createCrop(
  prevState: CropFormState,
  formData: FormData
): Promise<CropFormState> {
  const supabase = createSupabaseServerClient();

  const validatedFields = CropSchema.safeParse({
    plant_id: formData.get('plant_id'),
    bed_id: formData.get('bed_id'),
    row_spacing_cm: formData.get('row_spacing_cm') || null,
    seed_spacing_cm: formData.get('seed_spacing_cm') || null,
    planted_date: formData.get('planted_date') || null,
    harvested_date: formData.get('harvested_date') || null,
    status: formData.get('status') || 'planned',
  });

  if (!validatedFields.success) {
    console.error('Validation Error:', validatedFields.error.flatten().fieldErrors);
    return {
      message: 'Validation failed. Could not create crop.',
      errors: validatedFields.error.flatten().fieldErrors,
    };
  }

  // Ensure date fields are correctly formatted (null if empty)
  const cropData: CropInsert = {
    ...validatedFields.data,
    planted_date: validatedFields.data.planted_date ? formatDateForInput(validatedFields.data.planted_date) : null,
    harvested_date: validatedFields.data.harvested_date ? formatDateForInput(validatedFields.data.harvested_date) : null,
  };

  try {
    const { error } = await supabase.from('crops').insert(cropData);

    if (error) {
      console.error('Supabase Error:', error);
      if (error.code === '23503') { // foreign_key_violation
          return { message: 'Database Error: The selected Plant or Bed does not exist.' };
      }
      return { message: `Database Error: ${error.message}` };
    }

    revalidatePath('/dashboard/crops');
    return { message: 'Crop created successfully.', crop: null, errors: {} };

  } catch (e) {
    console.error('Unexpected Error:', e);
    return { message: 'An unexpected error occurred.' };
  }
}

// UPDATE Crop
export async function updateCrop(
  prevState: CropFormState,
  formData: FormData
): Promise<CropFormState> {
  const supabase = createSupabaseServerClient();
  const id = formData.get('id') as string;

  if (!id) {
    return { message: 'Error: Missing Crop ID for update.' };
  }

  const validatedFields = CropSchema.safeParse({
    id: id,
    plant_id: formData.get('plant_id'),
    bed_id: formData.get('bed_id'),
    row_spacing_cm: formData.get('row_spacing_cm') || null,
    seed_spacing_cm: formData.get('seed_spacing_cm') || null,
    planted_date: formData.get('planted_date') || null,
    harvested_date: formData.get('harvested_date') || null,
    status: formData.get('status') || 'planned',
  });

  if (!validatedFields.success) {
      console.error('Validation Error:', validatedFields.error.flatten().fieldErrors);
      return {
          message: 'Validation failed. Could not update crop.',
          errors: validatedFields.error.flatten().fieldErrors,
          crop: prevState.crop
      };
  }

  const { id: _, ...validatedData } = validatedFields.data;
  // Ensure date fields are correctly formatted (null if empty)
  const cropDataToUpdate: CropUpdate = {
      ...validatedData,
      planted_date: validatedData.planted_date ? formatDateForInput(validatedData.planted_date) : null,
      harvested_date: validatedData.harvested_date ? formatDateForInput(validatedData.harvested_date) : null,
  };

  try {
    const { error } = await supabase
      .from('crops')
      .update(cropDataToUpdate)
      .eq('id', id);

    if (error) {
      console.error('Supabase Error:', error);
       if (error.code === '23503') { // foreign_key_violation
          return { message: 'Database Error: The selected Plant or Bed does not exist.', crop: prevState.crop };
      }
      return { message: `Database Error: ${error.message}`, crop: prevState.crop };
    }

    revalidatePath('/dashboard/crops');
    return { message: 'Crop updated successfully.', crop: null, errors: {} };

  } catch (e) {
    console.error('Unexpected Error:', e);
    return { message: 'An unexpected error occurred.', crop: prevState.crop };
  }
}

// DELETE Crop
export async function deleteCrop(id: string): Promise<{ message: string }> {
  const supabase = createSupabaseServerClient();

  if (!id) {
    return { message: 'Error: Missing Crop ID for delete.' };
  }

  try {
    const { error } = await supabase.from('crops').delete().eq('id', id);

    if (error) {
      console.error('Supabase Error:', error);
      // No typical FK constraints prevent deleting a crop itself
      return { message: `Database Error: ${error.message}` };
    }

    revalidatePath('/dashboard/crops');
    return { message: 'Crop deleted successfully.' };

  } catch (e) {
    console.error('Unexpected Error:', e);
    return { message: 'An unexpected error occurred.' };
  }
}

// --- Helper function to get crops with related info ---
type CropWithDetails = Crop & {
  plants: { name: string; variety: string | null } | null;
  beds: { name: string, plots: { name: string } | null } | null;
};

export async function getCropsWithDetails(): Promise<{ crops?: CropWithDetails[]; error?: string }> {
  const supabase = createSupabaseServerClient();
  try {
    const { data, error } = await supabase
      .from('crops')
      // Select crop fields, plant name/variety, bed name, plot name
      .select(`
        *,
        plants ( name, variety ),
        beds ( name, plots ( name ) )
      `)
      .order('created_at', { ascending: false }); // Order by creation date, newest first

    if (error) {
      console.error('Supabase Error fetching crops:', error);
      return { error: `Database Error: ${error.message}` };
    }

    // Cast the result to the expected type
    const crops = data as CropWithDetails[] | null;

    return { crops: crops || [] };

  } catch (e) {
     console.error('Unexpected Error fetching crops:', e);
     return { error: 'An unexpected error occurred while fetching crops.' };
  }
} 