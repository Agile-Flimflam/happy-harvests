'use server';

import { createSupabaseServerClient, type Database, type Tables } from '@/lib/supabase-server';
import { revalidatePath } from 'next/cache';
import { fetchWeatherByCoords } from '@/lib/openweather';
import { LocationSchema } from '@/lib/validation/locations';

// Schema now centralized in src/lib/validation/locations

type Location = Tables<'locations'>;
type LocationInsert = Database['public']['Tables']['locations']['Insert'];
type LocationUpdate = Database['public']['Tables']['locations']['Update'];

export type LocationFormState = {
  message: string;
  errors?: Record<string, string[] | undefined>;
  location?: Location | null;
};

function valueOrNull(v: FormDataEntryValue | null): string | null {
  if (v === null) return null;
  const s = String(v);
  return s.trim() === '' ? null : s;
}

function numberOrNull(v: FormDataEntryValue | null): number | null {
  if (v === null) return null;
  const s = String(v).trim();
  if (s === '') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : (null as number | null);
}

export async function createLocation(
  prevState: LocationFormState,
  formData: FormData
): Promise<LocationFormState> {
  const supabase = await createSupabaseServerClient();
  const validated = LocationSchema.safeParse({
    name: formData.get('name'),
    street: valueOrNull(formData.get('street')),
    city: valueOrNull(formData.get('city')),
    state: valueOrNull(formData.get('state')),
    zip: valueOrNull(formData.get('zip')),
    latitude: numberOrNull(formData.get('latitude')),
    longitude: numberOrNull(formData.get('longitude')),
    notes: valueOrNull(formData.get('notes')),
  });
  if (!validated.success) {
    return {
      message: 'Validation failed. Could not create location.',
      errors: validated.error.flatten().fieldErrors,
    };
  }
  const payload: LocationInsert = {
    name: validated.data.name,
    street: validated.data.street ?? null,
    city: validated.data.city ?? null,
    state: validated.data.state ?? null,
    zip: validated.data.zip ?? null,
    latitude: validated.data.latitude ?? null,
    longitude: validated.data.longitude ?? null,
    timezone: null,
    notes: validated.data.notes ?? null,
  };
  // Populate timezone if coordinates are provided
  if (
    typeof validated.data.latitude === 'number' &&
    typeof validated.data.longitude === 'number'
  ) {
    try {
      const weather = await fetchWeatherByCoords(validated.data.latitude, validated.data.longitude, { units: 'imperial' });
      payload.timezone = weather.timezone ?? null;
    } catch (e) {
      console.error('OpenWeather timezone fetch failed on create:', e);
    }
  }
  const { error } = await supabase.from('locations').insert(payload);
  if (error) {
    return { message: `Database Error: ${error.message}` };
  }
  revalidatePath('/locations');
  return { message: 'Location created successfully.', location: null, errors: {} };
}

export async function updateLocation(
  prevState: LocationFormState,
  formData: FormData
): Promise<LocationFormState> {
  const supabase = await createSupabaseServerClient();
  const id = String(formData.get('id') || '');
  if (!id) {
    return { message: 'Error: Missing Location ID for update.' };
  }
  const validated = LocationSchema.safeParse({
    id,
    name: formData.get('name'),
    street: valueOrNull(formData.get('street')),
    city: valueOrNull(formData.get('city')),
    state: valueOrNull(formData.get('state')),
    zip: valueOrNull(formData.get('zip')),
    latitude: numberOrNull(formData.get('latitude')),
    longitude: numberOrNull(formData.get('longitude')),
    notes: valueOrNull(formData.get('notes')),
  });
  if (!validated.success) {
    return {
      message: 'Validation failed. Could not update location.',
      errors: validated.error.flatten().fieldErrors,
      location: prevState.location,
    };
  }
  const updateData: LocationUpdate = {
    name: validated.data.name,
    street: validated.data.street ?? null,
    city: validated.data.city ?? null,
    state: validated.data.state ?? null,
    zip: validated.data.zip ?? null,
    latitude: validated.data.latitude ?? null,
    longitude: validated.data.longitude ?? null,
    notes: validated.data.notes ?? null,
  };
  // Populate or clear timezone depending on coordinates
  if (
    typeof validated.data.latitude === 'number' &&
    typeof validated.data.longitude === 'number'
  ) {
    try {
      const weather = await fetchWeatherByCoords(validated.data.latitude, validated.data.longitude, { units: 'imperial' });
      updateData.timezone = weather.timezone ?? null;
    } catch (e) {
      console.error('OpenWeather timezone fetch failed on update:', e);
      // Keep timezone as null if fetch fails
    }
  } else if (
    validated.data.latitude == null &&
    validated.data.longitude == null
  ) {
    // If coords cleared, also clear timezone
    updateData.timezone = null;
  } else {
    // If only one coordinate is provided, avoid changing timezone by not setting it
  }
  const { error } = await supabase
    .from('locations')
    .update(updateData)
    .eq('id', id);
  if (error) {
    return { message: `Database Error: ${error.message}`, location: prevState.location };
  }
  revalidatePath('/locations');
  return { message: 'Location updated successfully.', location: null, errors: {} };
}

export async function deleteLocation(id: string): Promise<{ message: string }> {
  const supabase = await createSupabaseServerClient();
  if (!id) return { message: 'Error: Missing Location ID for delete.' };
  // Optional pre-check: if plots exist, warn earlier
  const { count, error: countError } = await supabase
    .from('plots')
    .select('plot_id', { count: 'exact', head: true })
    .eq('location_id', id);
  if (countError) {
    // Proceed anyway; the delete will fail if FK violation
    console.error('Count error on plots:', countError.message);
  }
  if ((count ?? 0) > 0) {
    return { message: 'Error: Cannot delete location while plots are associated. Reassign or delete plots first.' };
  }
  const { error } = await supabase.from('locations').delete().eq('id', id);
  if (error) {
    if (error.code === '23503') {
      return { message: 'Database Error: Cannot delete location due to existing associated plots.' };
    }
    return { message: `Database Error: ${error.message}` };
  }
  revalidatePath('/locations');
  return { message: 'Location deleted successfully.' };
}

type LocationWithMaybePlots = Location & { plots: Tables<'plots'>[] | null };
type LocationWithPlots = Location & { plots: Tables<'plots'>[] };

export async function getLocations(): Promise<{ locations?: Location[]; error?: string }> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('locations')
    .select('*')
    .order('name', { ascending: true });
  if (error) return { error: `Database Error: ${error.message}` };
  return { locations: (data as Location[]) || [] };
}

export async function getLocationWithPlots(id: string): Promise<{ location?: LocationWithPlots; error?: string }> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('locations')
    .select('*, plots(*)')
    .eq('id', id)
    .single();
  if (error) return { error: `Database Error: ${error.message}` };
  const loc = data as LocationWithMaybePlots;
  return { location: { ...loc, plots: loc.plots || [] } };
}


