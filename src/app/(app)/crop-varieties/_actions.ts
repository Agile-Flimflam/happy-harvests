'use server';

import { createSupabaseServerClient, type Database, type Enums } from '@/lib/supabase-server';
// Refactored to new schema: remove DaysToMaturity JSON
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

const CropVarietySchema = z.object({
  id: z.coerce.number().int().optional(),
  crop_id: z.coerce.number().int({ message: 'Crop is required' }),
  name: z.string().min(1, { message: 'Name is required' }),
  latin_name: z.string().min(1, { message: 'Latin name is required' }),
  is_organic: z.boolean().default(false),
  notes: z.string().optional().nullable(),
  dtm_direct_seed_min: z.coerce.number().int().nonnegative(),
  dtm_direct_seed_max: z.coerce.number().int().nonnegative(),
  dtm_transplant_min: z.coerce.number().int().nonnegative(),
  dtm_transplant_max: z.coerce.number().int().nonnegative(),
  plant_spacing_min: z.coerce.number().int().nonnegative().nullable(),
  plant_spacing_max: z.coerce.number().int().nonnegative().nullable(),
  row_spacing_min: z.coerce.number().int().nonnegative().nullable(),
  row_spacing_max: z.coerce.number().int().nonnegative().nullable(),
}).refine(data => data.dtm_direct_seed_min <= data.dtm_direct_seed_max, {
  message: 'Direct seed min must be <= max',
  path: ['dtm_direct_seed_max']
}).refine(data => data.dtm_transplant_min <= data.dtm_transplant_max, {
  message: 'Transplant min must be <= max',
  path: ['dtm_transplant_max']
});

type CropVariety = Database['public']['Tables']['crop_varieties']['Row'];
type CropVarietyInsert = Database['public']['Tables']['crop_varieties']['Insert'];
type CropVarietyUpdate = Database['public']['Tables']['crop_varieties']['Update'];

export type CropVarietyFormState = {
  message: string;
  errors?: Record<string, string[] | undefined>;
  cropVariety?: CropVariety | null;
}

// No JSON helper needed in new schema

const STORAGE_BUCKET = 'crop_variety_images';

function getFileExtension(file: File): string {
  const name = (file as unknown as { name?: string }).name || '';
  const dotIdx = name.lastIndexOf('.');
  if (dotIdx !== -1) return name.slice(dotIdx + 1).toLowerCase();
  const mime = file.type || '';
  switch (mime) {
    case 'image/jpeg':
      return 'jpg';
    case 'image/png':
      return 'png';
    case 'image/webp':
      return 'webp';
    case 'image/avif':
      return 'avif';
    default:
      return 'bin';
  }
}

function isSupportedImageType(file: File): boolean {
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];
  return allowed.includes(file.type);
}

function isFileLike(value: unknown): value is File {
  return (
    (typeof File !== 'undefined' && value instanceof File) ||
    (typeof value === 'object' && value !== null && 'size' in (value as Record<string, unknown>) && 'type' in (value as Record<string, unknown>))
  );
}

export async function createCropVariety(
  prevState: CropVarietyFormState,
  formData: FormData
): Promise<CropVarietyFormState> {
  const supabase = await createSupabaseServerClient();
  const validatedFields = CropVarietySchema.safeParse({
    crop_id: formData.get('crop_id'),
    name: formData.get('name'),
    latin_name: formData.get('latin_name'),
    is_organic: formData.get('is_organic') === 'on',
    notes: formData.get('notes') || null,
    dtm_direct_seed_min: formData.get('dtm_direct_seed_min'),
    dtm_direct_seed_max: formData.get('dtm_direct_seed_max'),
    dtm_transplant_min: formData.get('dtm_transplant_min'),
    dtm_transplant_max: formData.get('dtm_transplant_max'),
    plant_spacing_min: formData.get('plant_spacing_min') || null,
    plant_spacing_max: formData.get('plant_spacing_max') || null,
    row_spacing_min: formData.get('row_spacing_min') || null,
    row_spacing_max: formData.get('row_spacing_max') || null,
  });
  if (!validatedFields.success) {
    console.error('Validation Error:', validatedFields.error.flatten().fieldErrors);
    return {
      message: 'Validation failed. Could not create crop variety.',
      errors: validatedFields.error.flatten().fieldErrors,
    };
  }
  const cropVarietyData: CropVarietyInsert = {
    crop_id: validatedFields.data.crop_id,
    name: validatedFields.data.name,
    latin_name: validatedFields.data.latin_name,
    is_organic: validatedFields.data.is_organic,
    notes: validatedFields.data.notes ?? null,
    dtm_direct_seed_min: validatedFields.data.dtm_direct_seed_min,
    dtm_direct_seed_max: validatedFields.data.dtm_direct_seed_max,
    dtm_transplant_min: validatedFields.data.dtm_transplant_min,
    dtm_transplant_max: validatedFields.data.dtm_transplant_max,
    plant_spacing_min: validatedFields.data.plant_spacing_min ?? null,
    plant_spacing_max: validatedFields.data.plant_spacing_max ?? null,
    row_spacing_min: validatedFields.data.row_spacing_min ?? null,
    row_spacing_max: validatedFields.data.row_spacing_max ?? null,
  };
  try {
    // Insert first to get the new ID
    const { data: inserted, error: insertError } = await supabase
      .from('crop_varieties')
      .insert(cropVarietyData as Database['public']['Tables']['crop_varieties']['Insert'])
      .select()
      .single();
    if (insertError || !inserted) {
      console.error('Supabase Error (insert):', insertError);
      return { message: `Database Error: ${insertError?.message || 'Insert failed'}` };
    }

    // Handle optional image upload
    const fileEntry = formData.get('image');
    const file = isFileLike(fileEntry) ? fileEntry : null;
    if (file && file.size > 0) {
      if (!isSupportedImageType(file)) {
        // Rollback row if image invalid
        await supabase.from('crop_varieties').delete().eq('id', inserted.id);
        return { message: 'Validation failed. Unsupported image type. Allowed: JPEG, PNG, WEBP, AVIF.' };
      }
      if (file.size > 5 * 1024 * 1024) {
        await supabase.from('crop_varieties').delete().eq('id', inserted.id);
        return { message: 'Validation failed. Image size exceeds 5MB.' };
      }

      const ext = getFileExtension(file);
      const randomSuffix = Math.random().toString(36).slice(2, 8);
      const path = `${inserted.id}/${Date.now()}_${randomSuffix}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(path, file, {
          cacheControl: '3600',
          upsert: true,
          contentType: file.type || 'application/octet-stream',
        });
      if (uploadError) {
        console.error('Storage upload error:', uploadError);
        // Rollback created row on upload failure
        await supabase.from('crop_varieties').delete().eq('id', inserted.id);
        return { message: `Image upload failed: ${uploadError.message}` };
      }

      const { error: updateError } = await supabase
        .from('crop_varieties')
        .update({ image_path: path } as CropVarietyUpdate)
        .eq('id', inserted.id);
      if (updateError) {
        console.error('Supabase Error (update image_path):', updateError);
        return { message: `Database Error: ${updateError.message}` };
      }
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
  const idRaw = formData.get('id') as string;
  const id = idRaw ? parseInt(idRaw, 10) : NaN;
  if (!id || Number.isNaN(id)) {
    return { message: 'Error: Missing Crop Variety ID for update.' };
  }
  // Fetch existing to know current image_path
  const { data: existing, error: fetchError } = await supabase
    .from('crop_varieties')
    .select('id, image_path')
    .eq('id', id)
    .single();
  if (fetchError || !existing) {
    console.error('Supabase Error (fetch existing):', fetchError);
    return { message: `Database Error: ${fetchError?.message || 'Not found'}`, cropVariety: prevState.cropVariety };
  }
  const validatedFields = CropVarietySchema.safeParse({
    id,
    crop_id: formData.get('crop_id'),
    name: formData.get('name'),
    latin_name: formData.get('latin_name'),
    is_organic: formData.get('is_organic') === 'on',
    notes: formData.get('notes') || null,
    dtm_direct_seed_min: formData.get('dtm_direct_seed_min'),
    dtm_direct_seed_max: formData.get('dtm_direct_seed_max'),
    dtm_transplant_min: formData.get('dtm_transplant_min'),
    dtm_transplant_max: formData.get('dtm_transplant_max'),
    plant_spacing_min: formData.get('plant_spacing_min') || null,
    plant_spacing_max: formData.get('plant_spacing_max') || null,
    row_spacing_min: formData.get('row_spacing_min') || null,
    row_spacing_max: formData.get('row_spacing_max') || null,
  });
  if (!validatedFields.success) {
    console.error('Validation Error:', validatedFields.error.flatten().fieldErrors);
    return {
      message: 'Validation failed. Could not update crop variety.',
      errors: validatedFields.error.flatten().fieldErrors,
      cropVariety: prevState.cropVariety,
    };
  }
  const v = validatedFields.data as unknown as CropVarietyUpdate & { id: number };
  const cropVarietyDataToUpdate: CropVarietyUpdate = {
    crop_id: v.crop_id,
    name: v.name,
    latin_name: v.latin_name,
    is_organic: v.is_organic,
    notes: v.notes ?? null,
    dtm_direct_seed_min: v.dtm_direct_seed_min,
    dtm_direct_seed_max: v.dtm_direct_seed_max,
    dtm_transplant_min: v.dtm_transplant_min,
    dtm_transplant_max: v.dtm_transplant_max,
    plant_spacing_min: v.plant_spacing_min ?? null,
    plant_spacing_max: v.plant_spacing_max ?? null,
    row_spacing_min: v.row_spacing_min ?? null,
    row_spacing_max: v.row_spacing_max ?? null,
  };
  try {
    // Handle remove image option
    const removeImage = formData.get('remove_image') === 'on';
    const fileEntry = formData.get('image');
    const file = isFileLike(fileEntry) ? fileEntry : null;

    if (removeImage && existing.image_path) {
      await supabase.storage.from(STORAGE_BUCKET).remove([existing.image_path]);
      cropVarietyDataToUpdate.image_path = null;
    }

    if (file && file.size > 0) {
      if (!isSupportedImageType(file)) {
        return { message: 'Validation failed. Unsupported image type. Allowed: JPEG, PNG, WEBP, AVIF.', cropVariety: prevState.cropVariety };
      }
      if (file.size > 5 * 1024 * 1024) {
        return { message: 'Validation failed. Image size exceeds 5MB.', cropVariety: prevState.cropVariety };
      }

      // Delete old image if exists (best-effort)
      if (existing.image_path) {
        await supabase.storage.from(STORAGE_BUCKET).remove([existing.image_path]);
      }

      const ext = getFileExtension(file);
      const randomSuffix = Math.random().toString(36).slice(2, 8);
      const path = `${id}/${Date.now()}_${randomSuffix}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(path, file, {
          cacheControl: '3600',
          upsert: true,
          contentType: file.type || 'application/octet-stream',
        });
      if (uploadError) {
        console.error('Storage upload error:', uploadError);
        return { message: `Image upload failed: ${uploadError.message}`, cropVariety: prevState.cropVariety };
      }
      cropVarietyDataToUpdate.image_path = path;
    }

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

export async function deleteCropVariety(id: string | number): Promise<{ message: string }> {
  const supabase = await createSupabaseServerClient();
  const numericId = typeof id === 'number' ? id : parseInt(id, 10);
  if (!numericId || Number.isNaN(numericId)) {
    return { message: 'Error: Missing Crop Variety ID for delete.' };
  }
  try {
    // Clean up image if present
    const { data: existing, error: fetchError } = await supabase
      .from('crop_varieties')
      .select('image_path')
      .eq('id', numericId)
      .single();
    if (!fetchError && existing?.image_path) {
      await supabase.storage.from(STORAGE_BUCKET).remove([existing.image_path]);
    }

    const { error } = await supabase.from('crop_varieties').delete().eq('id', numericId);
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

// Inline Crop creation for the Crop Varieties page
type Crop = Database['public']['Tables']['crops']['Row'];
type CropInsert = Database['public']['Tables']['crops']['Insert'];
type CropType = Enums<'crop_type'>;

const SimpleCropSchema = z.object({
  name: z.string().min(1, { message: 'Name is required' }),
  crop_type: z.enum(['Vegetable', 'Fruit', 'Windbreak', 'Covercrop'], { message: 'Crop type is required' }),
});

export type SimpleCropFormState = {
  message: string;
  errors?: Record<string, string[] | undefined>;
  crop?: Crop | null;
}

export async function createCropSimple(
  prevState: SimpleCropFormState,
  formData: FormData
): Promise<SimpleCropFormState> {
  const supabase = await createSupabaseServerClient();
  const validated = SimpleCropSchema.safeParse({
    name: formData.get('name'),
    crop_type: formData.get('crop_type'),
  });
  if (!validated.success) {
    return { message: 'Validation failed. Could not create crop.', errors: validated.error.flatten().fieldErrors };
  }
  const insertData: CropInsert = {
    name: validated.data.name,
    crop_type: validated.data.crop_type as CropType,
  };
  const { data, error } = await supabase.from('crops').insert(insertData).select('*').single();
  if (error) {
    console.error('Supabase Error (createCropSimple):', error);
    return { message: `Database Error: ${error.message}` };
  }
  // No revalidate here; caller updates local state
  return { message: 'Crop created successfully.', crop: data as Crop, errors: {} };
}

export async function getCropVarieties(): Promise<{ cropVarieties?: (CropVariety & { crops: { name: string } | null } & { image_url?: string | null })[]; error?: string }> {
  const supabase = await createSupabaseServerClient();
  try {
    const { data, error } = await supabase
      .from('crop_varieties')
      .select('*, crops(name)')
      .order('name', { ascending: true });
    if (error) {
      console.error('Supabase Error fetching crop varieties:', error);
      return { error: `Database Error: ${error.message}` };
    }
    const withUrls = (data || []).map((row) => {
      if (row.image_path) {
        const { data: pub } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(row.image_path);
        return { ...row, image_url: pub?.publicUrl || null } as CropVariety & { crops: { name: string } | null } & { image_url?: string | null };
      }
      return { ...row, image_url: null } as CropVariety & { crops: { name: string } | null } & { image_url?: string | null };
    });
    withUrls.sort((a, b) => {
      const cropA = (a.crops?.name || '').toString();
      const cropB = (b.crops?.name || '').toString();
      const byCrop = cropA.localeCompare(cropB, undefined, { sensitivity: 'base' });
      if (byCrop !== 0) return byCrop;
      return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
    });
    return { cropVarieties: withUrls };
  } catch (e) {
    console.error('Unexpected Error fetching crop varieties:', e);
    return { error: 'An unexpected error occurred while fetching crop varieties.' };
  }
}


