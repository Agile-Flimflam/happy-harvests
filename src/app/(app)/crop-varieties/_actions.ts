'use server';

import { createSupabaseServerClient, type Database } from '@/lib/supabase-server';
import type { DaysToMaturity } from '@/lib/database.types';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

type NonNullDaysToMaturity = Exclude<DaysToMaturity, null>;

const CropVarietySchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1, { message: 'Name is required' }),
  variety: z.string().optional().nullable(),
  latin_name: z.string().optional().nullable(),
  is_organic: z.boolean().default(false),
  color: z.string().optional().nullable(),
  size: z.string().optional().nullable(),
  disease_resistance: z.string().min(1, { message: 'Disease Resistance information is required.' }),
  hybrid_status: z.string().min(1, { message: 'Hybrid Status is required.' }),
  notes: z.string().optional().nullable(),
  directSeedMin: z.coerce.number().int().nonnegative().nullable(),
  directSeedMax: z.coerce.number().int().nonnegative().nullable(),
  transplantMin: z.coerce.number().int().nonnegative().nullable(),
  transplantMax: z.coerce.number().int().nonnegative().nullable(),
}).refine(data => {
  if (data.directSeedMin != null && data.directSeedMax != null) {
    return data.directSeedMin <= data.directSeedMax;
  }
  return true;
}, {
  message: "Direct Seed: Min days must be less than or equal to Max days",
  path: ["directSeedMax"],
}).refine(data => {
  if (data.transplantMin != null && data.transplantMax != null) {
    return data.transplantMin <= data.transplantMax;
  }
  return true;
}, {
  message: "Transplant: Min days must be less than or equal to Max days",
  path: ["transplantMax"],
});

type CropVariety = Database['public']['Tables']['crop_varieties']['Row'];
type CropVarietyInsert = Omit<Database['public']['Tables']['crop_varieties']['Insert'], 'days_to_maturity'> & { days_to_maturity?: DaysToMaturity | null };
type CropVarietyUpdate = Omit<Database['public']['Tables']['crop_varieties']['Update'], 'days_to_maturity'> & { days_to_maturity?: DaysToMaturity | null };

export type CropVarietyFormState = {
  message: string;
  errors?: Record<string, string[] | undefined>;
  cropVariety?: CropVariety | null;
}

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
      min: data.directSeedMin ?? 0,
      max: data.directSeedMax ?? 0,
    };
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
  if (!hasDirectSeed && !hasTransplant) {
    return null;
  }
  return dtm;
};

export async function createCropVariety(
  prevState: CropVarietyFormState,
  formData: FormData
): Promise<CropVarietyFormState> {
  const supabase = await createSupabaseServerClient();
  const validatedFields = CropVarietySchema.safeParse({
    name: formData.get('name'),
    variety: formData.get('variety') || null,
    latin_name: formData.get('latin_name') || null,
    is_organic: formData.get('is_organic') === 'on',
    color: formData.get('color') || null,
    size: formData.get('size') || null,
    disease_resistance: formData.get('disease_resistance') || null,
    hybrid_status: formData.get('hybrid_status') || null,
    notes: formData.get('notes') || null,
    directSeedMin: formData.get('directSeedMin') || null,
    directSeedMax: formData.get('directSeedMax') || null,
    transplantMin: formData.get('transplantMin') || null,
    transplantMax: formData.get('transplantMax') || null,
  });
  if (!validatedFields.success) {
    console.error('Validation Error:', validatedFields.error.flatten().fieldErrors);
    return {
      message: 'Validation failed. Could not create crop variety.',
      errors: validatedFields.error.flatten().fieldErrors,
    };
  }
  const days_to_maturity = constructDaysToMaturity(validatedFields.data);
  const baseData = { ...validatedFields.data } as Record<string, unknown>;
  delete baseData.directSeedMin;
  delete baseData.directSeedMax;
  delete baseData.transplantMin;
  delete baseData.transplantMax;
  const cropVarietyData: CropVarietyInsert = {
    ...(baseData as CropVarietyInsert),
    days_to_maturity,
  };
  try {
    const { error } = await supabase.from('crop_varieties').insert(cropVarietyData as Database['public']['Tables']['crop_varieties']['Insert']);
    if (error) {
      console.error('Supabase Error:', error);
      return { message: `Database Error: ${error.message}` };
    }
    revalidatePath('/crop-varieties');
    return { message: 'Crop variety created successfully.', cropVariety: null, errors: {} };
  } catch (e) {
    console.error('Unexpected Error:', e);
    return { message: 'An unexpected error occurred.' };
  }
}

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
    id: id,
    name: formData.get('name'),
    variety: formData.get('variety') || null,
    latin_name: formData.get('latin_name') || null,
    is_organic: formData.get('is_organic') === 'on',
    color: formData.get('color') || null,
    size: formData.get('size') || null,
    disease_resistance: formData.get('disease_resistance') || null,
    hybrid_status: formData.get('hybrid_status') || null,
    notes: formData.get('notes') || null,
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
      cropVariety: prevState.cropVariety,
    };
  }
  const days_to_maturity = constructDaysToMaturity(validatedFields.data);
  const baseData = { ...validatedFields.data } as Record<string, unknown>;
  delete baseData.id;
  delete baseData.directSeedMin;
  delete baseData.directSeedMax;
  delete baseData.transplantMin;
  delete baseData.transplantMax;
  const cropVarietyDataToUpdate: CropVarietyUpdate = {
    ...(baseData as CropVarietyUpdate),
    days_to_maturity,
  };
  try {
    const { error } = await supabase
      .from('crop_varieties')
      .update(cropVarietyDataToUpdate as Database['public']['Tables']['crop_varieties']['Update'])
      .eq('id', id);
    if (error) {
      console.error('Supabase Error:', error);
      return { message: `Database Error: ${error.message}`, cropVariety: prevState.cropVariety };
    }
    revalidatePath('/crop-varieties');
    return { message: 'Crop variety updated successfully.', cropVariety: null, errors: {} };
  } catch (e) {
    console.error('Unexpected Error:', e);
    return { message: 'An unexpected error occurred.', cropVariety: prevState.cropVariety };
  }
}

export async function deleteCropVariety(id: string): Promise<{ message: string }> {
  const supabase = await createSupabaseServerClient();
  if (!id) {
    return { message: 'Error: Missing Crop Variety ID for delete.' };
  }
  try {
    const { error } = await supabase.from('crop_varieties').delete().eq('id', id);
    if (error) {
      console.error('Supabase Error:', error);
      if (error.code === '23503') {
        return { message: 'Database Error: Cannot delete crop variety because it is currently associated with one or more crops.' };
      }
      return { message: `Database Error: ${error.message}` };
    }
    revalidatePath('/crop-varieties');
    return { message: 'Crop variety deleted successfully.' };
  } catch (e) {
    console.error('Unexpected Error:', e);
    return { message: 'An unexpected error occurred.' };
  }
}

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
    return { cropVarieties: data || [] };
  } catch (e) {
    console.error('Unexpected Error fetching crop varieties:', e);
    return { error: 'An unexpected error occurred while fetching crop varieties.' };
  }
}


