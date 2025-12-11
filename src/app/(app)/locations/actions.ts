import type { Tables } from '@/lib/supabase-server';
import { fetchWeatherByCoords } from '@/lib/openweather';
import {
  asActionError,
  asActionSuccess,
  createCorrelationId,
  type ActionResult,
} from '@/lib/action-result';
import { getQuickCreatePrefs, type QuickCreatePrefs } from '@/lib/quick-create-prefs';
import {
  createLocation,
  updateLocation,
  deleteLocation,
  getLocations,
  getLocationWithPlots,
  type LocationFormState,
  type DeleteLocationResult,
  rememberLocationSelection,
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
  quickCreatePrefs: QuickCreatePrefs | null;
};

export async function getLocationsWithWeather(): Promise<ActionResult<LocationsWithWeather>> {
  const correlationId = createCorrelationId();
  const base = await getLocations();
  if (base.error) {
    return asActionError({
      code: 'server',
      message: base.error,
      correlationId,
    });
  }
  const locations = base.locations ?? [];
  const weatherByLocation: Record<string, WeatherSnapshot> = {};
  const MAX_CONCURRENT_REQUESTS = 5;

  for (let i = 0; i < locations.length; i += MAX_CONCURRENT_REQUESTS) {
    const batch = locations.slice(i, i + MAX_CONCURRENT_REQUESTS);
    // Batch requests to stay within provider rate limits
    await Promise.all(
      batch.map(async (loc) => {
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
  }

  const quickCreatePrefs = await getQuickCreatePrefs();

  return asActionSuccess(
    { locations, weatherByLocation, quickCreatePrefs },
    undefined,
    correlationId
  );
}

export {
  createLocation,
  updateLocation,
  deleteLocation,
  getLocations,
  getLocationWithPlots,
  type LocationFormState,
  type DeleteLocationResult,
  rememberLocationSelection,
};
