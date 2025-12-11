'use server';

import { createSupabaseServerClient } from '@/lib/supabase-server';
import type { Database } from '@/lib/database.types';
// Refactored to new schema: remove DaysToMaturity JSON
import { revalidatePath } from 'next/cache';
import { CropVarietySchema, SimpleCropSchema } from '@/lib/validation/crop-varieties';
import {
  getCropVarietyPrefs,
  pushRecentCrop,
  rememberVarietyDefaults,
  toggleFavoriteCropPref,
  type CropVarietyDefaults,
  type CropVarietyPrefs,
} from '@/lib/crop-variety-prefs';

// Schema now centralized in src/lib/validation/crop-varieties

type CropVariety = Database['public']['Tables']['crop_varieties']['Row'];
type CropVarietyInsert = Database['public']['Tables']['crop_varieties']['Insert'];
type CropVarietyUpdate = Database['public']['Tables']['crop_varieties']['Update'];
type CropVarietyWithImageUrl = CropVariety & { image_url: string | null };

export type CropVarietyFormState = {
  message: string;
  errors?: Record<string, string[] | undefined>;
  cropVariety?: CropVarietyWithImageUrl | null;
};

// No JSON helper needed in new schema

const DUPLICATE_MESSAGE = 'A variety with this crop and name already exists.';
const DUPLICATE_LATIN_MESSAGE = 'A variety with this crop and Latin name already exists.';
const DUPLICATE_CROP_MESSAGE = 'A crop with this name already exists.';

const normalizeText = (value: string) => value.trim().toLocaleLowerCase();

const STORAGE_BUCKET = 'crop_variety_images';
function getPublicImageUrl(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  path: string | null
): string | null {
  if (!path) return null;
  return supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path).data?.publicUrl ?? null;
}

function getFileExtension(file: File): string {
  const name = file.name || '';
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
  return typeof File !== 'undefined' && value instanceof File;
}

async function assertUniqueCrop(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  name: string
): Promise<{ ok: true } | { ok: false; message: string; errors: Record<string, string[]> }> {
  const normalizedName = normalizeText(name);
  const { data, error } = await supabase
    .from('crops')
    .select('id, name')
    .ilike('name', normalizedName);
  if (error) {
    return {
      ok: false,
      message: `Database Error: ${error.message}`,
      errors: { name: [`${error.message}`] },
    };
  }
  if (data && data.length > 0) {
    return {
      ok: false,
      message: DUPLICATE_CROP_MESSAGE,
      errors: { name: [DUPLICATE_CROP_MESSAGE] },
    };
  }
  return { ok: true };
}

async function assertUniqueVariety(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  payload: { cropId: number; name: string; latinName: string; excludeId?: number }
): Promise<{ ok: true } | { ok: false; message: string; errors: Record<string, string[]> }> {
  const { cropId, name, latinName, excludeId } = payload;
  const normalizedName = normalizeText(name);
  const normalizedLatin = normalizeText(latinName);
  const query = supabase
    .from('crop_varieties')
    .select('id, name, latin_name')
    .eq('crop_id', cropId)
    .or(`name.ilike.${normalizedName},latin_name.ilike.${normalizedLatin}`);
  const { data, error } = await query;
  if (error) {
    return {
      ok: false,
      message: `Database Error: ${error.message}`,
      errors: { name: [error.message] },
    };
  }
  const duplicates = (data ?? []).filter((row) => row.id !== excludeId);
  if (duplicates.length > 0) {
    const errors: Record<string, string[]> = {
      name: [DUPLICATE_MESSAGE],
    };
    if (
      duplicates.some((row) => normalizeText(row.latin_name ?? '') === normalizeText(latinName))
    ) {
      errors.latin_name = [DUPLICATE_LATIN_MESSAGE];
    }
    return {
      ok: false,
      message: DUPLICATE_MESSAGE,
      errors,
    };
  }
  return { ok: true };
}

async function rememberVarietyPrefsAfterSave(
  cropId: number,
  defaults?: CropVarietyDefaults
): Promise<void> {
  await pushRecentCrop(cropId, defaults);
  if (defaults) {
    await rememberVarietyDefaults(defaults);
  }
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
  const duplicateCheck = await assertUniqueVariety(supabase, {
    cropId: validatedFields.data.crop_id,
    name: validatedFields.data.name,
    latinName: validatedFields.data.latin_name,
  });
  if (!duplicateCheck.ok) {
    return { message: duplicateCheck.message, errors: duplicateCheck.errors };
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
      .insert(cropVarietyData)
      .select()
      .single();
    if (insertError || !inserted) {
      console.error('Supabase Error (insert):', insertError);
      return { message: `Database Error: ${insertError?.message || 'Insert failed'}` };
    }

    let imagePath: string | null = inserted.image_path ?? null;
    // Handle optional image upload
    const fileEntry = formData.get('image');
    const file = isFileLike(fileEntry) ? fileEntry : null;
    if (file && file.size > 0) {
      if (!isSupportedImageType(file)) {
        // Rollback row if image invalid
        await supabase.from('crop_varieties').delete().eq('id', inserted.id);
        return {
          message: 'Validation failed. Unsupported image type. Allowed: JPEG, PNG, WEBP, AVIF.',
        };
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

      imagePath = path;
      const { error: updateError } = await supabase
        .from('crop_varieties')
        .update({ image_path: path })
        .eq('id', inserted.id);
      if (updateError) {
        console.error('Supabase Error (update image_path):', updateError);
        return { message: `Database Error: ${updateError.message}` };
      }
    }

    revalidatePath('/crop-varieties');
    await rememberVarietyPrefsAfterSave(validatedFields.data.crop_id, {
      cropId: validatedFields.data.crop_id,
      isOrganic: validatedFields.data.is_organic,
    });
    const imageUrl = getPublicImageUrl(supabase, imagePath);
    return {
      message: 'Crop variety created successfully.',
      cropVariety: { ...inserted, image_path: imagePath, image_url: imageUrl },
      errors: {},
    };
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
  const idEntry = formData.get('id');
  if (typeof idEntry !== 'string') {
    return { message: 'Error: Missing Crop Variety ID for update.' };
  }

  const id = Number.parseInt(idEntry, 10);
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
    return {
      message: `Database Error: ${fetchError?.message || 'Not found'}`,
      cropVariety: prevState.cropVariety,
    };
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
  const v = validatedFields.data;
  const duplicateCheck = await assertUniqueVariety(supabase, {
    cropId: v.crop_id,
    name: v.name,
    latinName: v.latin_name,
    excludeId: id,
  });
  if (!duplicateCheck.ok) {
    return {
      message: duplicateCheck.message,
      errors: duplicateCheck.errors,
      cropVariety: prevState.cropVariety,
    };
  }
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

    const existingImagePath: string | null = existing.image_path ?? null;
    let imagePath: string | null = existingImagePath;

    if (file && file.size > 0) {
      if (!isSupportedImageType(file)) {
        return {
          message: 'Validation failed. Unsupported image type. Allowed: JPEG, PNG, WEBP, AVIF.',
          cropVariety: prevState.cropVariety,
        };
      }
      if (file.size > 5 * 1024 * 1024) {
        return {
          message: 'Validation failed. Image size exceeds 5MB.',
          cropVariety: prevState.cropVariety,
        };
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
        return {
          message: `Image upload failed: ${uploadError.message}`,
          cropVariety: prevState.cropVariety,
        };
      }
      cropVarietyDataToUpdate.image_path = path;
      imagePath = path;
    } else if (removeImage) {
      // Only mark for removal; delete after successful DB update to avoid inconsistency.
      cropVarietyDataToUpdate.image_path = null;
      imagePath = null;
    }

    const { error } = await supabase
      .from('crop_varieties')
      .update(cropVarietyDataToUpdate)
      .eq('id', id);
    if (error) {
      console.error('Supabase Error:', error);
      return { message: `Database Error: ${error.message}`, cropVariety: prevState.cropVariety };
    }
    const { data: updatedRow, error: fetchUpdatedError } = await supabase
      .from('crop_varieties')
      .select('*')
      .eq('id', id)
      .single();
    if (fetchUpdatedError || !updatedRow) {
      console.error('Supabase Error (fetch updated):', fetchUpdatedError);
      return {
        message: `Database Error: ${fetchUpdatedError?.message || 'Not found'}`,
        cropVariety: prevState.cropVariety,
      };
    }
    // Best-effort cleanup after successful update.
    if (existingImagePath && (removeImage || (imagePath && imagePath !== existingImagePath))) {
      try {
        await supabase.storage.from(STORAGE_BUCKET).remove([existingImagePath]);
      } catch (cleanupError) {
        console.error('Storage cleanup error:', cleanupError);
      }
    }
    const imageUrl = getPublicImageUrl(supabase, imagePath ?? updatedRow.image_path ?? null);
    revalidatePath('/crop-varieties');
    await rememberVarietyPrefsAfterSave(v.crop_id, { cropId: v.crop_id, isOrganic: v.is_organic });
    return {
      message: 'Crop variety updated successfully.',
      cropVariety: { ...updatedRow, image_url: imageUrl },
      errors: {},
    };
  } catch (e) {
    console.error('Unexpected Error:', e);
    return { message: 'An unexpected error occurred.', cropVariety: prevState.cropVariety };
  }
}

export type DeleteCropVarietyResult = {
  message: string;
};

export async function deleteCropVariety(id: string | number): Promise<DeleteCropVarietyResult> {
  const supabase = await createSupabaseServerClient();
  const numericId = typeof id === 'number' ? id : parseInt(id, 10);
  if (!numericId || Number.isNaN(numericId)) {
    return { message: 'Error: Missing Crop Variety ID for delete.' };
  }
  try {
    // Fetch image path first; defer deletion until after DB delete succeeds
    const { data: existing, error: fetchError } = await supabase
      .from('crop_varieties')
      .select('image_path')
      .eq('id', numericId)
      .single();
    const imagePath = !fetchError ? (existing?.image_path ?? null) : null;
    const { error } = await supabase.from('crop_varieties').delete().eq('id', numericId);
    if (error) {
      console.error('Supabase Error:', error);
      if (error.code === '23503') {
        return {
          message:
            'Database Error: Cannot delete crop variety because it is currently associated with one or more crops.',
        };
      }
      return { message: `Database Error: ${error.message}` };
    }
    if (imagePath) {
      try {
        await supabase.storage.from(STORAGE_BUCKET).remove([imagePath]);
      } catch (cleanupError) {
        console.error('Storage cleanup error on delete:', cleanupError);
      }
    }
    revalidatePath('/crop-varieties');
    return { message: 'Crop variety deleted successfully.' };
  } catch (e) {
    console.error('Unexpected Error:', e);
    return { message: 'An unexpected error occurred.' };
  }
}

// Inline Crop creation for the Crop Varieties page
export type Crop = Database['public']['Tables']['crops']['Row'];
type CropInsert = Database['public']['Tables']['crops']['Insert'];
type CropVarietyWithCropName = CropVariety & {
  crops: { name: string } | null;
  image_url: string | null;
};

// Schema now centralized in src/lib/validation/crop-varieties

export type SimpleCropFormState = {
  message: string;
  errors?: Record<string, string[] | undefined>;
  crop?: Crop | null;
};

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
    return {
      message: 'Validation failed. Could not create crop.',
      errors: validated.error.flatten().fieldErrors,
    };
  }
  const duplicateCheck = await assertUniqueCrop(supabase, validated.data.name);
  if (!duplicateCheck.ok) {
    return { message: duplicateCheck.message, errors: duplicateCheck.errors };
  }
  const insertData: CropInsert = {
    name: validated.data.name,
    crop_type: validated.data.crop_type,
  };
  const { data, error } = await supabase.from('crops').insert(insertData).select('*').single();
  if (error) {
    console.error('Supabase Error (createCropSimple):', error);
    return { message: `Database Error: ${error.message}` };
  }
  // Invalidate cached crop lists so dropdowns render the new crop without a manual refresh.
  revalidatePath('/crop-varieties');
  await rememberVarietyPrefsAfterSave(data.id ?? 0);
  return { message: 'Crop created successfully.', crop: data, errors: {} };
}

export async function getCropVarieties(): Promise<{
  cropVarieties: CropVarietyWithCropName[];
  error?: string;
}> {
  const supabase = await createSupabaseServerClient();
  try {
    const { data, error } = await supabase
      .from('crop_varieties')
      .select('*, crops(name)')
      .order('name', { ascending: true });
    if (error) {
      console.error('Supabase Error fetching crop varieties:', error);
      return { cropVarieties: [], error: `Database Error: ${error.message}` };
    }
    const withUrls: CropVarietyWithCropName[] = (data || []).map((row) => {
      const imageUrl = row.image_path
        ? supabase.storage.from(STORAGE_BUCKET).getPublicUrl(row.image_path).data?.publicUrl || null
        : null;
      return { ...row, image_url: imageUrl };
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
    return {
      cropVarieties: [],
      error: 'An unexpected error occurred while fetching crop varieties.',
    };
  }
}

export type CropWithMinimalFields = Pick<Crop, 'id' | 'name' | 'crop_type' | 'created_at'>;

export type CropVarietyContext = {
  cropVarieties: CropVarietyWithCropName[];
  crops: CropWithMinimalFields[];
  prefs: CropVarietyPrefs | null;
  error?: string;
};

export async function getCropVarietyContext(): Promise<CropVarietyContext> {
  const supabase = await createSupabaseServerClient();
  const [{ cropVarieties, error }, { data: crops, error: cropError }, prefs] = await Promise.all([
    getCropVarieties(),
    supabase
      .from('crops')
      .select('id, name, crop_type, created_at')
      .order('name', { ascending: true })
      .returns<CropWithMinimalFields[]>(),
    getCropVarietyPrefs(),
  ]);

  return {
    cropVarieties,
    crops: crops ?? [],
    prefs: prefs ?? null,
    error: error ?? cropError?.message,
  };
}

export async function toggleFavoriteCrop(cropId: number): Promise<CropVarietyPrefs | null> {
  const result = await toggleFavoriteCropPref(cropId);
  if (!result.ok) {
    console.error('Failed to toggle favorite crop', result.error);
    return null;
  }
  return result.prefs;
}
