'use server';

import { createSupabaseServerClient, type Database } from '@/lib/supabase-server';
import type { DaysToMaturity } from '@/lib/database.types';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

// Define Zod schema for the nested days to maturity object
const DaysToMaturitySchema = z.object({
  DirectSeed: z.object({
    min: z.coerce.number().int().nonnegative({ message: 'Must be a non-negative number.' }),
    max: z.coerce.number().int().nonnegative({ message: 'Must be a non-negative number.' }),
  }).nullable(),
  Transplant: z.object({
    min: z.coerce.number().int().nonnegative({ message: 'Must be a non-negative number.' }),
    max: z.coerce.number().int().nonnegative({ message: 'Must be a non-negative number.' }),
  }).nullable(),
}).nullable(); // Allow the whole object to be null

// Define a non-nullable DaysToMaturity object type for constructing data
type NonNullDaysToMaturity = Exclude<DaysToMaturity, null>;

// Define Zod schema for crop variety validation
const CropVarietySchema = z.object({
  id: z.string().uuid().optional(), // Optional for insert
  name: z.string().min(1, { message: 'Name is required' }),
  variety: z.string().optional().nullable(),
  latin_name: z.string().optional().nullable(),
  is_organic: z.boolean().default(false),
  // Replace avg_days_to_maturity with the nested schema inputs (will be constructed)
  // days_to_maturity will be constructed from form inputs before insertion/update
  color: z.string().optional().nullable(),
  size: z.string().optional().nullable(),
  disease_resistance: z.string().min(1, { message: 'Disease Resistance information is required.' }),
  hybrid_status: z.string().min(1, { message: 'Hybrid Status is required.' }),
  notes: z.string().optional().nullable(),
  // Add individual fields for validation, will be combined later
  directSeedMin: z.coerce.number().int().nonnegative().nullable(),
  directSeedMax: z.coerce.number().int().nonnegative().nullable(),
  transplantMin: z.coerce.number().int().nonnegative().nullable(),
  transplantMax: z.coerce.number().int().nonnegative().nullable(),
}).refine(data => {
    // Validate min <= max for DirectSeed if both are provided
    if (data.directSeedMin != null && data.directSeedMax != null) {
        return data.directSeedMin <= data.directSeedMax;
    }
    return true;
}, {
    message: "Direct Seed: Min days must be less than or equal to Max days",
    path: ["directSeedMax"], // Assign error to the max field
}).refine(data => {
    // Validate min <= max for Transplant if both are provided
    if (data.transplantMin != null && data.transplantMax != null) {
        return data.transplantMin <= data.transplantMax;
    }
    return true;
}, {
    message: "Transplant: Min days must be less than or equal to Max days",
    path: ["transplantMax"], // Assign error to the max field
});


type CropVariety = Database['public']['Tables']['crop_varieties']['Row'];
// Update Insert type to reflect the JSON structure
type CropVarietyInsert = Omit<Database['public']['Tables']['crop_varieties']['Insert'], 'days_to_maturity'> & {
    days_to_maturity?: DaysToMaturity | null;
};
// Update Update type similarly
type CropVarietyUpdate = Omit<Database['public']['Tables']['crop_varieties']['Update'], 'days_to_maturity'> & {
    days_to_maturity?: DaysToMaturity | null;
};


export type CropVarietyFormState = {
  message: string;
  errors?: Record<string, string[] | undefined>;
  cropVariety?: CropVariety | null;
}

// Helper function to construct DaysToMaturity JSON
const constructDaysToMaturity = (data: {
    directSeedMin: number | null,
    directSeedMax: number | null,
    transplantMin: number | null,
    transplantMax: number | null,
}): DaysToMaturity | null => {
    const dtm: NonNullDaysToMaturity = { DirectSeed: null, Transplant: null };
    let hasDirectSeed = false;
    let hasTransplant = false;

    if (data.directSeedMin !== null || data.directSeedMax !== null) {
        dtm.DirectSeed = {
            min: data.directSeedMin ?? 0, // Default to 0 if only max is provided? Or handle validation?
            max: data.directSeedMax ?? 0, // Default to 0 if only min is provided? Or handle validation?
        };
        // Ensure both are numbers if the object exists
         if (dtm.DirectSeed) {
             dtm.DirectSeed.min = typeof dtm.DirectSeed.min === 'number' ? dtm.DirectSeed.min : 0;
             dtm.DirectSeed.max = typeof dtm.DirectSeed.max === 'number' ? dtm.DirectSeed.max : 0;
             hasDirectSeed = true;
         }
    }

    if (data.transplantMin !== null || data.transplantMax !== null) {
        dtm.Transplant = {
            min: data.transplantMin ?? 0,
            max: data.transplantMax ?? 0,
        };
         if (dtm.Transplant) {
             dtm.Transplant.min = typeof dtm.Transplant.min === 'number' ? dtm.Transplant.min : 0;
             dtm.Transplant.max = typeof dtm.Transplant.max === 'number' ? dtm.Transplant.max : 0;
             hasTransplant = true;
         }
    }


    // Return null if neither section has data
    if (!hasDirectSeed && !hasTransplant) {
        return null;
    }

    // Return the constructed object
    return dtm;
};


// CREATE Crop Variety
export async function createCropVariety(
  prevState: CropVarietyFormState,
  formData: FormData
): Promise<CropVarietyFormState> {
  const supabase = await createSupabaseServerClient();

  const validatedFields = CropVarietySchema.safeParse({
    name: formData.get('name'),
    variety: formData.get('variety') || null,
    latin_name: formData.get('latin_name') || null,
    is_organic: formData.get('is_organic') === 'on', // Checkbox/Switch value
    color: formData.get('color') || null,
    size: formData.get('size') || null,
    disease_resistance: formData.get('disease_resistance') || null,
    hybrid_status: formData.get('hybrid_status') || null,
    notes: formData.get('notes') || null,
    // Parse individual day fields
    directSeedMin: formData.get('directSeedMin') || null,
    directSeedMax: formData.get('directSeedMax') || null,
    transplantMin: formData.get('transplantMin') || null,
    transplantMax: formData.get('transplantMax') || null,
  });

  // If form validation fails, return errors early.
  if (!validatedFields.success) {
    console.error('Validation Error:', validatedFields.error.flatten().fieldErrors);
    return {
      message: 'Validation failed. Could not create crop variety.',
      errors: validatedFields.error.flatten().fieldErrors,
    };
  }

  // Construct the days_to_maturity object
  const days_to_maturity = constructDaysToMaturity(validatedFields.data);

  // Separate base data from the days_to_maturity fields
  const {
      directSeedMin, directSeedMax, transplantMin, transplantMax,
      ...baseData
  } = validatedFields.data;


  const cropVarietyData: CropVarietyInsert = {
      ...baseData,
      days_to_maturity: days_to_maturity, // Add the constructed JSON object
  };


  try {
    // Use the correct type for insertion
    const { error } = await supabase.from('crop_varieties').insert(cropVarietyData as Database['public']['Tables']['crop_varieties']['Insert']);


    if (error) {
      console.error('Supabase Error:', error);
      return { message: `Database Error: ${error.message}` };
    }

    revalidatePath('/dashboard/crop-varieties'); // Revalidate cache for the crop varieties page
    return { message: 'Crop variety created successfully.', cropVariety: null, errors: {} }; // Reset form state

  } catch (e) {
    console.error('Unexpected Error:', e);
    return { message: 'An unexpected error occurred.' };
  }
}

// UPDATE Crop Variety
export async function updateCropVariety(
  prevState: CropVarietyFormState,
  formData: FormData
): Promise<CropVarietyFormState> {
    const supabase = await createSupabaseServerClient();
    const id = formData.get('id') as string;

    if (!id) {
      return { message: 'Error: Missing Crop Variety ID for update.' };
    }

    const validatedFields = CropVarietySchema.safeParse({
      id: id, // Include ID for context
      name: formData.get('name'),
      variety: formData.get('variety') || null,
      latin_name: formData.get('latin_name') || null,
      is_organic: formData.get('is_organic') === 'on',
      color: formData.get('color') || null,
      size: formData.get('size') || null,
      disease_resistance: formData.get('disease_resistance') || null,
      hybrid_status: formData.get('hybrid_status') || null,
      notes: formData.get('notes') || null,
      // Parse individual day fields
      directSeedMin: formData.get('directSeedMin') || null,
      directSeedMax: formData.get('directSeedMax') || null,
      transplantMin: formData.get('transplantMin') || null,
      transplantMax: formData.get('transplantMax') || null,
    });

    if (!validatedFields.success) {
        console.error('Validation Error:', validatedFields.error.flatten().fieldErrors);
        return {
            message: 'Validation failed. Could not update crop variety.',
            errors: validatedFields.error.flatten().fieldErrors,
            cropVariety: prevState.cropVariety // Keep existing crop variety data in form if validation fails
        };
    }

    // Construct the days_to_maturity object
    const days_to_maturity = constructDaysToMaturity(validatedFields.data);

    // Separate base data from the days_to_maturity fields and id
    const {
        id: _, directSeedMin, directSeedMax, transplantMin, transplantMax,
        ...baseData
    } = validatedFields.data;


    const cropVarietyDataToUpdate: CropVarietyUpdate = {
        ...baseData,
        days_to_maturity: days_to_maturity,
    };


    try {
        // Use the correct type for update
        const { error } = await supabase
            .from('crop_varieties')
            .update(cropVarietyDataToUpdate as Database['public']['Tables']['crop_varieties']['Update'])
            .eq('id', id);

        if (error) {
            console.error('Supabase Error:', error);
            return { message: `Database Error: ${error.message}`, cropVariety: prevState.cropVariety };
        }

        revalidatePath('/dashboard/crop-varieties');
        return { message: 'Crop variety updated successfully.', cropVariety: null, errors: {} }; // Clear form on success

    } catch (e) {
        console.error('Unexpected Error:', e);
        return { message: 'An unexpected error occurred.', cropVariety: prevState.cropVariety };
    }
}

// DELETE Crop Variety
export async function deleteCropVariety(id: string): Promise<{ message: string }> {
  const supabase = await createSupabaseServerClient();

  if (!id) {
    return { message: 'Error: Missing Crop Variety ID for delete.' };
  }

  try {
    const { error } = await supabase.from('crop_varieties').delete().eq('id', id);

    if (error) {
      console.error('Supabase Error:', error);
      // Handle potential foreign key constraint errors (e.g., if crop variety is used in crops)
      if (error.code === '23503') { // foreign_key_violation
         return { message: 'Database Error: Cannot delete crop variety because it is currently associated with one or more crops.' };
      }
      return { message: `Database Error: ${error.message}` };
    }

    revalidatePath('/dashboard/crop-varieties');
    return { message: 'Crop variety deleted successfully.' };

  } catch (e) {
    console.error('Unexpected Error:', e);
    return { message: 'An unexpected error occurred.' };
  }
}

// --- Helper function to get crop varieties (can be used in server components) ---
export async function getCropVarieties(): Promise<{ cropVarieties?: CropVariety[]; error?: string }> {
  const supabase = await createSupabaseServerClient();
  try {
    const { data, error } = await supabase
      .from('crop_varieties')
      .select('*')
      .order('name', { ascending: true })
      .order('variety', { ascending: true, nullsFirst: false });

    if (error) {
      console.error('Supabase Error fetching crop varieties:', error);
      return { error: `Database Error: ${error.message}` };
    }
    // Rename 'plants' to 'cropVarieties' in the returned object
    return { cropVarieties: data || [] };
  } catch (e) {
     console.error('Unexpected Error fetching crop varieties:', e);
     return { error: 'An unexpected error occurred while fetching crop varieties.' };
  }
} 