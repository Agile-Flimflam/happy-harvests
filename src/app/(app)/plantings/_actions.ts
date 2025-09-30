"use server";

import { createSupabaseServerClient, type Tables } from "@/lib/supabase-server";
import { revalidatePath } from "next/cache";

type Planting = Tables<'plantings'>;

export type PlantingFormState = {
  message: string;
  errors?: Record<string, string[] | undefined>;
  planting?: Planting | null;
}

// Server Actions for form submissions (UI-friendly)
export async function actionNurserySow(prev: PlantingFormState, formData: FormData): Promise<PlantingFormState> {
  const supabase = await createSupabaseServerClient();
  const cropVarietyId = formData.get('crop_variety_id');
  const qtyInitial = formData.get('qty_initial');
  const nurseryId = formData.get('nursery_id');
  const eventDate = formData.get('event_date');
  const notes = (formData.get('notes') as string) || undefined;
  const { error } = await supabase.rpc('fn_create_nursery_planting', {
    p_crop_variety_id: Number(cropVarietyId),
    p_qty_initial: Number(qtyInitial),
    p_nursery_id: String(nurseryId),
    p_event_date: String(eventDate),
    p_notes: notes ?? undefined,
  });
  if (error) return { message: `Database Error: ${error.message}` };
  revalidatePath('/plantings');
  return { message: 'Nursery planting created.' };
}

export async function actionDirectSeed(prev: PlantingFormState, formData: FormData): Promise<PlantingFormState> {
  const supabase = await createSupabaseServerClient();
  const cropVarietyId = formData.get('crop_variety_id');
  const qtyInitial = formData.get('qty_initial');
  const bedId = formData.get('bed_id');
  const eventDate = formData.get('event_date');
  const notes = (formData.get('notes') as string) || undefined;
  const { error } = await supabase.rpc('fn_create_direct_seed_planting', {
    p_crop_variety_id: Number(cropVarietyId),
    p_qty_initial: Number(qtyInitial),
    p_bed_id: Number(bedId),
    p_event_date: String(eventDate),
    p_notes: notes ?? undefined,
  });
  if (error) return { message: `Database Error: ${error.message}` };
  revalidatePath('/plantings');
  return { message: 'Direct-seeded planting created.' };
}

export async function deletePlanting(id: number | string): Promise<{ message: string }> {
  const supabase = await createSupabaseServerClient();
  const numericId = typeof id === 'number' ? id : parseInt(id, 10);
  if (!numericId || Number.isNaN(numericId)) {
    return { message: 'Error: Missing Planting ID for delete.' };
  }
  const today = new Date().toISOString().slice(0, 10);
  const { error } = await supabase.rpc('fn_remove_planting', {
    p_planting_id: numericId,
    p_event_date: today,
    p_reason: 'deleted via UI'
  });
  if (error) {
    console.error('Supabase RPC Error:', error);
    return { message: `Database Error: ${error.message}` };
  }
  revalidatePath('/plantings');
  return { message: 'Planting removed successfully.' };
}

type PlantingWithDetails = Planting & {
  crop_varieties: { name: string; latin_name: string; crops: { name: string } | null } | null;
  beds: {
    id: number;
    length_inches: number | null;
    width_inches: number | null;
    plots: { locations: { name: string } | null } | null;
  } | null;
  nurseries: { name: string } | null;
};

export async function getPlantingsWithDetails(): Promise<{ plantings?: PlantingWithDetails[]; error?: string }> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('plantings')
    .select(`
      *,
      crop_varieties ( name, latin_name, crops ( name ) ),
      beds ( id, length_inches, width_inches, plots ( locations ( name ) ) ),
      nurseries ( name )
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

// Lifecycle actions (RPC)
export async function createNurseryPlanting(input: { crop_variety_id: number; qty_initial: number; nursery_id: string; event_date: string; notes?: string }) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc('fn_create_nursery_planting', {
    p_crop_variety_id: input.crop_variety_id,
    p_qty_initial: input.qty_initial,
    p_nursery_id: input.nursery_id,
    p_event_date: input.event_date,
    p_notes: input.notes ?? undefined,
  });
  if (error) return { error: error.message };
  revalidatePath('/plantings');
  return { ok: true };
}

export async function createDirectSeedPlanting(input: { crop_variety_id: number; qty_initial: number; bed_id: number; event_date: string; notes?: string }) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc('fn_create_direct_seed_planting', {
    p_crop_variety_id: input.crop_variety_id,
    p_qty_initial: input.qty_initial,
    p_bed_id: input.bed_id,
    p_event_date: input.event_date,
    p_notes: input.notes ?? undefined,
  });
  if (error) return { error: error.message };
  revalidatePath('/plantings');
  return { ok: true };
}

export async function transplantPlanting(input: { planting_id: number; bed_id: number; event_date: string }) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc('fn_transplant_planting', {
    p_planting_id: input.planting_id,
    p_bed_id: input.bed_id,
    p_event_date: input.event_date,
  });
  if (error) return { error: error.message };
  revalidatePath('/plantings');
  return { ok: true };
}

export async function movePlanting(input: { planting_id: number; bed_id: number; event_date: string }) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc('fn_move_planting', {
    p_planting_id: input.planting_id,
    p_bed_id: input.bed_id,
    p_event_date: input.event_date,
  });
  if (error) return { error: error.message };
  revalidatePath('/plantings');
  return { ok: true };
}

export async function harvestPlanting(input: { planting_id: number; event_date: string; qty_harvested?: number | null; weight_grams?: number | null; quantity_unit?: string | null }) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc('fn_harvest_planting', {
    p_planting_id: input.planting_id,
    p_event_date: input.event_date,
    p_qty_harvested: input.qty_harvested ?? undefined,
    p_weight_grams: input.weight_grams ?? undefined,
    p_quantity_unit: input.quantity_unit ?? undefined,
  });
  if (error) return { error: error.message };
  revalidatePath('/plantings');
  return { ok: true };
}

type BedForSelect = Pick<Tables<'beds'>, 'id' | 'length_inches' | 'width_inches'> & { plots?: { locations: { name: string } | null } | null };

export async function getBedsForSelect(): Promise<{ beds?: BedForSelect[]; error?: string }> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('beds')
    .select('id, length_inches, width_inches, plots(locations(name))')
    .order('id', { ascending: true });
  if (error) return { error: error.message };
  return { beds: (data as unknown as BedForSelect[]) || [] };
}

type NurseryForSelect = Pick<Tables<'nurseries'>, 'id'> & { name: string };

export async function getNurseriesForSelect(): Promise<{ nurseries?: NurseryForSelect[]; error?: string }> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('nurseries')
    .select('id, name')
    .order('name', { ascending: true });
  if (error) return { error: error.message };
  return { nurseries: (data as unknown as NurseryForSelect[]) || [] };
}
