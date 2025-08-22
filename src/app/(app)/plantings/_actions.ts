'use server';

import { createSupabaseServerClient, type Database, type Tables, type Enums } from '@/lib/supabase-server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

type Planting = Tables<'bed_plantings'>;
type PlantingInsert = Database['public']['Tables']['bed_plantings']['Insert'];
type PlantingUpdate = Database['public']['Tables']['bed_plantings']['Update'];

export type PlantingType = Enums<'planting_type'>;
export type PlantingStatus = Enums<'bed_planting_status'>;

export type PlantingFormState = {
  message: string;
  errors?: Record<string, string[] | undefined>;
  planting?: Planting | null;
}

const PlantingSchema = z.object({
  id: z.coerce.number().int().optional(),
  crop_variety_id: z.coerce.number().int({ message: 'Plant Variety selection is required' }),
  bed_id: z.coerce.number().int({ message: 'Bed selection is required' }),
  planting_type: z.custom<PlantingType>(),
  qty_planting: z.coerce.number().int().positive({ message: 'Quantity must be positive' }),
  date_planted: z.string().regex(/\d{4}-\d{2}-\d{2}/, { message: 'Date is required (YYYY-MM-DD)' }),
  harvested_date: z.string().regex(/\d{4}-\d{2}-\d{2}/).nullable().optional(),
  status: z.custom<PlantingStatus>(),
  notes: z.string().optional().nullable(),
});

export async function createPlanting(
  prevState: PlantingFormState,
  formData: FormData
): Promise<PlantingFormState> {
  const supabase = await createSupabaseServerClient();
  const validated = PlantingSchema.safeParse({
    crop_variety_id: formData.get('crop_variety_id'),
    bed_id: formData.get('bed_id'),
    planting_type: formData.get('planting_type'),
    qty_planting: formData.get('qty_planting'),
    date_planted: formData.get('date_planted'),
    harvested_date: formData.get('harvested_date') || null,
    status: formData.get('status'),
    notes: formData.get('notes') || null,
  });
  if (!validated.success) {
    const fields = validated.error.flatten().fieldErrors;
    return { message: 'Validation failed. Could not create planting.', errors: fields };
  }
  const insertData: PlantingInsert = {
    crop_variety_id: validated.data.crop_variety_id,
    bed_id: validated.data.bed_id,
    planting_type: validated.data.planting_type as PlantingType,
    qty_planting: validated.data.qty_planting,
    date_planted: validated.data.date_planted,
    harvested_date: validated.data.harvested_date ?? null,
    status: validated.data.status as PlantingStatus,
    notes: validated.data.notes ?? null,
  };
  const { error } = await supabase.from('bed_plantings').insert(insertData);
  if (error) {
    console.error('Supabase Error:', error);
    return { message: `Database Error: ${error.message}` };
  }
  revalidatePath('/plantings');
  return { message: 'Planting created successfully.', planting: null, errors: {} };
}

export async function updatePlanting(
  prevState: PlantingFormState,
  formData: FormData
): Promise<PlantingFormState> {
  const supabase = await createSupabaseServerClient();
  const validated = PlantingSchema.safeParse({
    id: formData.get('id'),
    crop_variety_id: formData.get('crop_variety_id'),
    bed_id: formData.get('bed_id'),
    planting_type: formData.get('planting_type'),
    qty_planting: formData.get('qty_planting'),
    date_planted: formData.get('date_planted'),
    harvested_date: formData.get('harvested_date') || null,
    status: formData.get('status'),
    notes: formData.get('notes') || null,
  });
  if (!validated.success || !validated.data.id) {
    const fields = !validated.success ? validated.error.flatten().fieldErrors : {};
    return { message: 'Validation failed. Could not update planting.', errors: fields, planting: prevState.planting };
  }
  const { id, ...rest } = validated.data;
  const updateData: PlantingUpdate = {
    crop_variety_id: rest.crop_variety_id,
    bed_id: rest.bed_id,
    planting_type: rest.planting_type as PlantingType,
    qty_planting: rest.qty_planting,
    date_planted: rest.date_planted,
    harvested_date: rest.harvested_date ?? null,
    status: rest.status as PlantingStatus,
    notes: rest.notes ?? null,
  };
  const { error } = await supabase.from('bed_plantings').update(updateData).eq('id', id);
  if (error) {
    console.error('Supabase Error:', error);
    return { message: `Database Error: ${error.message}`, planting: prevState.planting };
  }
  revalidatePath('/plantings');
  return { message: 'Planting updated successfully.', planting: null, errors: {} };
}

export async function deletePlanting(id: number | string): Promise<{ message: string }> {
  const supabase = await createSupabaseServerClient();
  const numericId = typeof id === 'number' ? id : parseInt(id, 10);
  if (!numericId || Number.isNaN(numericId)) {
    return { message: 'Error: Missing Planting ID for delete.' };
  }
  const { error } = await supabase.from('bed_plantings').delete().eq('id', numericId);
  if (error) {
    console.error('Supabase Error:', error);
    return { message: `Database Error: ${error.message}` };
  }
  revalidatePath('/plantings');
  return { message: 'Planting deleted successfully.' };
}

type PlantingWithDetails = Planting & {
  crop_varieties: { name: string; latin_name: string; crops: { name: string } | null } | null;
  beds: { id: number; length_inches: number | null; width_inches: number | null; plots: { location: string } | null } | null;
};

export async function getPlantingsWithDetails(): Promise<{ plantings?: PlantingWithDetails[]; error?: string }> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('bed_plantings')
    .select(`
      *,
      crop_varieties ( name, latin_name, crops ( name ) ),
      beds ( id, length_inches, width_inches, plots ( location ) )
    `)
    .order('created_at', { ascending: false });
  if (error) {
    console.error('Supabase Error fetching plantings:', error);
    return { error: `Database Error: ${error.message}` };
  }
  return { plantings: (data as PlantingWithDetails[]) || [] };
}

type CropVarietyForSelect = Pick<Tables<'crop_varieties'>, 'id' | 'name' | 'latin_name'> & { crops?: { name: string } | null };

export async function getCropVarietiesForSelect(): Promise<{ varieties?: CropVarietyForSelect[]; error?: string }> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('crop_varieties')
    .select('id, name, latin_name, crops(name)')
    .order('name', { ascending: true });
  if (error) return { error: error.message };
  return { varieties: (data as unknown as CropVarietyForSelect[]) || [] };
}

type BedForSelect = Pick<Tables<'beds'>, 'id' | 'length_inches' | 'width_inches'> & { plots?: { location: string } | null };

export async function getBedsForSelect(): Promise<{ beds?: BedForSelect[]; error?: string }> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('beds')
    .select('id, length_inches, width_inches, plots(location)')
    .order('id', { ascending: true });
  if (error) return { error: error.message };
  return { beds: (data as unknown as BedForSelect[]) || [] };
}


