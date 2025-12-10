import type { Tables } from '@/lib/supabase-server';
import { fetchWeatherByCoords } from '@/lib/openweather';
import { asActionError, type ActionResult } from '@/lib/action-result';
import {
  createLocation,
  updateLocation,
  deleteLocation,
  getLocations,
  getLocationWithPlots,
  type LocationFormState,
  type DeleteLocationResult,
} from './_actions';

export type LocationDTO = Tables<'locations'>;

export type WeatherSnapshot = {
  timezone: string;
  current: {
    dt: number;
    sunrise?: number;
    sunset?: number;
    temp: number;
    humidity: number;
    weather: { id: number; main: string; description: string; icon: string } | null;
  };
  moonPhase?: number;
  moonPhaseLabel?: string;
};

export type LocationsWithWeather = {
  locations: LocationDTO[];
  weatherByLocation: Record<string, WeatherSnapshot>;
};

export async function getLocationsWithWeather(): Promise<ActionResult<LocationsWithWeather>> {
  const base = await getLocations();
  if (base.error) {
    return asActionError({
      code: 'server',
      message: base.error,
    });
  }
  const locations = base.locations ?? [];
  const weatherByLocation: Record<string, WeatherSnapshot> = {};

  await Promise.all(
    locations.map(async (loc) => {
      if (loc.latitude == null || loc.longitude == null) return;
      try {
        const weather = await fetchWeatherByCoords(loc.latitude, loc.longitude, {
          units: 'imperial',
        });
        weatherByLocation[loc.id] = weather;
      } catch (error) {
        console.error('[Locations] Weather fetch failed', { id: loc.id, error });
      }
    })
  );

  return { ok: true, data: { locations, weatherByLocation } };
}

export {
  createLocation,
  updateLocation,
  deleteLocation,
  getLocations,
  getLocationWithPlots,
  type LocationFormState,
  type DeleteLocationResult,
};
