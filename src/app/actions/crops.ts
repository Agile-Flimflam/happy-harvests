'use server';

import { createSupabaseServerClient, type Database, type Tables, type Enums } from '@/lib/supabase-server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

// Define Zod schema for crop validation - Use crop_variety_id
const CropStatusEnum = z.enum(['planned', 'planted', 'growing', 'harvested']);

const CropSchema = z.object({
  id: z.string().uuid().optional(),
  crop_variety_id: z.string().uuid({ message: 'Plant Variety selection is required' }),
  bed_id: z.string().uuid({ message: 'Bed selection is required' }),
  row_spacing_cm: z.coerce.number().int().positive().optional().nullable(),
  seed_spacing_cm: z.coerce.number().int().positive().optional().nullable(),
  planted_date: z.coerce.date().optional().nullable(),
  harvested_date: z.coerce.date().optional().nullable(),
  status: CropStatusEnum.default('planned'),
});

// Use base types (assuming they now correctly use crop_variety_id)
type Crop = Tables<'crops'>;
type CropInsert = Database['public']['Tables']['crops']['Insert'];
type CropUpdate = Database['public']['Tables']['crops']['Update'];

export type CropStatus = Enums<'crop_status'>;

// Use the base Crop type and Zod error paths
export type CropFormState = {
  message: string;
  errors?: z.ZodIssue['path'][]; 
  crop?: Crop | null;
}

// Helper function expects Date | null | undefined
function formatDateForInput(date: Date | null | undefined): string {
    return date ? date.toISOString().split('T')[0] : '';
}

// CREATE Crop
export async function createCrop(
  prevState: CropFormState,
  formData: FormData
): Promise<CropFormState> {
  const supabase = await createSupabaseServerClient();

  // Validate using crop_variety_id
  const validatedFields = CropSchema.safeParse({
    crop_variety_id: formData.get('crop_variety_id'),
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
      errors: validatedFields.error.issues.map(issue => issue.path),
    };
  }

  // Prepare data for Supabase insert using spread
  const cropData: CropInsert = {
    ...validatedFields.data,
    planted_date: validatedFields.data.planted_date ? formatDateForInput(validatedFields.data.planted_date) : null,
    harvested_date: validatedFields.data.harvested_date ? formatDateForInput(validatedFields.data.harvested_date) : null,
  };

  try {
    // Types should align now
    const { error } = await supabase.from('crops').insert(cropData);

    if (error) {
        console.error('Supabase Error:', error);
        if (error.code === '23503') {
            return { message: 'Database Error: The selected Plant Variety or Bed does not exist.' };
        }
        return { message: `Database Error: ${error.message}` };
    }

    revalidatePath('/dashboard/crops');
    return { message: 'Crop created successfully.', crop: null, errors: [] };

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
  const supabase = await createSupabaseServerClient();
  const id = formData.get('id') as string;

  if (!id) {
    return { message: 'Error: Missing Crop ID for update.' };
  }

  // Validate using crop_variety_id
  const validatedFields = CropSchema.safeParse({
    id: id,
    crop_variety_id: formData.get('crop_variety_id'),
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
          errors: validatedFields.error.issues.map(issue => issue.path),
          crop: prevState.crop
      };
  }

  const { id: cropId, ...dataToUpdate } = validatedFields.data;
  // Prepare data for Supabase update using spread
  const cropDataToUpdate: Omit<CropUpdate, 'id'> = {
      ...dataToUpdate,
      planted_date: dataToUpdate.planted_date ? formatDateForInput(dataToUpdate.planted_date) : null,
      harvested_date: dataToUpdate.harvested_date ? formatDateForInput(dataToUpdate.harvested_date) : null,
  };

  try {
    // Types should align now
    const { error } = await supabase
      .from('crops')
      .update(cropDataToUpdate)
      .eq('id', cropId!);

    if (error) {
        console.error('Supabase Error:', error);
        if (error.code === '23503') {
            return { message: 'Database Error: The selected Plant Variety or Bed does not exist.', crop: prevState.crop };
        }
        return { message: `Database Error: ${error.message}`, crop: prevState.crop };
    }

    revalidatePath('/dashboard/crops');
    return { message: 'Crop updated successfully.', crop: null, errors: [] };

  } catch (e) {
    console.error('Unexpected Error:', e);
    return { message: 'An unexpected error occurred.', crop: prevState.crop };
  }
}

// DELETE Crop
export async function deleteCrop(id: string): Promise<{ message: string }> {
  const supabase = await createSupabaseServerClient();

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
// Define CropWithDetails using crop_variety_id and the 'crop_varieties' relationship
type CropWithDetails = Crop & {
    // Base Crop type now has crop_variety_id from generated types
    crop_varieties: { name: string; variety: string | null } | null; 
    beds: { name: string, plots: { name: string } | null } | null;
};

export async function getCropsWithDetails(): Promise<{ crops?: CropWithDetails[]; error?: string }> {
  const supabase = await createSupabaseServerClient();
  try {
    // Select all crop fields (*), and related data via relationships
    // Use 'crop_varieties' as the relationship name
    const { data, error } = await supabase
      .from('crops')
      .select(`
        *,
        crop_varieties ( name, variety ), 
        beds ( name, plots ( name ) )
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Supabase Error fetching crops:', error);
       // Add check for crop_varieties relationship error
       if (error.message.includes('relation "crop_varieties" does not exist')) {
           return { error: 'Database Error: Relationship setup between crops and crop_varieties (as \'crop_varieties\') might be missing or incorrect.' };
       }
      return { error: `Database Error: ${error.message}` };
    }

    // Casting should work if base types are correct and relationships exist
    const crops = data as CropWithDetails[] | null;

    return { crops: crops || [] };

  } catch (e) {
     console.error('Unexpected Error fetching crops:', e);
     return { error: 'An unexpected error occurred while fetching crops.' };
  }
} 