import { z } from 'zod';
import { getOpenWeatherIntegration } from './integrations';
import { hawaiianMoonPhaseLabel, lunarPhaseFractionAtLocalNoon } from './hawaiian-moon';

export type FetchWeatherOptions = {
  units?: 'imperial' | 'metric';
};

const WeatherEntrySchema = z.object({
  id: z.number(),
  main: z.string(),
  description: z.string(),
  icon: z.string(),
});

function openWeatherError(res: Response, body: string): Error {
  // Log detailed response server-side for diagnostics while returning a generic message
  console.error('OpenWeather API error', {
    status: res.status,
    statusText: res.statusText,
    body,
  });
  let clientMessage = 'Weather service error';
  if (res.status === 401) {
    clientMessage = 'Weather API authentication failed';
  } else if (res.status === 403) {
    clientMessage = 'Weather API access is forbidden';
  } else if (res.status === 429) {
    clientMessage = 'Weather API rate limit exceeded';
  }
  return new Error(clientMessage);
}

const OpenWeatherOneCallSchema = z.object({
  timezone: z.string(),
  current: z.object({
    dt: z.number(),
    sunrise: z.number().optional(),
    sunset: z.number().optional(),
    temp: z.number(),
    humidity: z.number(),
    weather: z.array(WeatherEntrySchema).optional(),
  }),
  daily: z
    .array(
      z.object({
        dt: z.number().optional(),
        temp: z.object({ day: z.number().optional() }).optional(),
        moon_phase: z.number().optional(),
        humidity: z.number().optional(),
        weather: z.array(WeatherEntrySchema).optional(),
      })
    )
    .optional(),
});

export async function fetchWeatherByCoords(
  latitude: number,
  longitude: number,
  options: FetchWeatherOptions = {}
): Promise<{
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
}> {
  const { apiKey, enabled } = await getOpenWeatherIntegration();
  const cleanKey = apiKey?.trim() || null;
  if (!enabled || !cleanKey) {
    throw new Error('OpenWeather integration is not configured');
  }

  // Use One Call 3.0 (matches your subscription)
  const url = new URL('https://api.openweathermap.org/data/3.0/onecall');
  url.searchParams.set('lat', String(latitude));
  url.searchParams.set('lon', String(longitude));
  url.searchParams.set('exclude', 'minutely,hourly,alerts');
  url.searchParams.set('appid', cleanKey);
  url.searchParams.set('units', options.units === 'metric' ? 'metric' : 'imperial');

  const res = await fetch(url.toString(), { method: 'GET', cache: 'no-store' });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw openWeatherError(res, text);
  }

  const json = OpenWeatherOneCallSchema.parse(await res.json());

  const currentWeather = json.current.weather?.[0] ?? null;
  let moonPhase = json.daily && json.daily[0] ? json.daily[0].moon_phase : undefined;
  // Fallback: compute from local-noon at the location's timezone
  if (moonPhase == null) {
    try {
      const approx = lunarPhaseFractionAtLocalNoon(
        new Date((json.current.dt || 0) * 1000),
        json.timezone
      );
      moonPhase = approx;
    } catch {
      // ignore
    }
  }
  const moonPhaseLabel =
    moonPhase != null ? (hawaiianMoonPhaseLabel(moonPhase) ?? undefined) : undefined;

  return {
    timezone: json.timezone,
    current: {
      dt: json.current.dt,
      sunrise: json.current.sunrise,
      sunset: json.current.sunset,
      temp: json.current.temp,
      humidity: json.current.humidity,
      weather: currentWeather,
    },
    moonPhase,
    moonPhaseLabel,
  };
}

// Fetch daily forecast (7-8 days) and return the entry that best matches the given date (UTC day match)
export async function fetchForecastForDateByCoords(
  latitude: number,
  longitude: number,
  date: Date,
  options: FetchWeatherOptions = {}
): Promise<{
  timezone: string;
  forecast: {
    dt: number;
    temp: number;
    humidity?: number;
    weather: { id: number; main: string; description: string; icon: string } | null;
    moonPhase?: number;
    moonPhaseLabel?: string;
  } | null;
}> {
  const { apiKey, enabled } = await getOpenWeatherIntegration();
  const cleanKey = apiKey?.trim() || null;
  if (!enabled || !cleanKey) {
    throw new Error('OpenWeather integration is not configured');
  }

  // Use One Call 3.0 (matches your subscription)
  const url = new URL('https://api.openweathermap.org/data/3.0/onecall');
  url.searchParams.set('lat', String(latitude));
  url.searchParams.set('lon', String(longitude));
  url.searchParams.set('exclude', 'minutely,hourly,alerts');
  url.searchParams.set('appid', cleanKey);
  url.searchParams.set('units', options.units === 'metric' ? 'metric' : 'imperial');

  const res = await fetch(url.toString(), { method: 'GET', cache: 'no-store' });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw openWeatherError(res, text);
  }
  const json = OpenWeatherOneCallSchema.parse(await res.json());

  const targetYmd = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  );
  const targetDayStart = Math.floor(targetYmd.getTime() / 1000);
  let best: {
    dt: number;
    temp?: { day?: number };
    moon_phase?: number;
    humidity?: number;
    weather?: Array<{ id: number; main: string; description: string; icon: string }>;
  } | null = null;
  let bestDiff = Infinity;
  for (const d of json.daily || []) {
    const dayDt = typeof d.dt === 'number' ? d.dt : null;
    if (dayDt == null) continue;
    const diff = Math.abs(dayDt - targetDayStart);
    if (diff < bestDiff) {
      best = { ...d, dt: dayDt };
      bestDiff = diff;
    }
  }
  if (!best) {
    return { timezone: json.timezone, forecast: null };
  }
  const weather = (best.weather && best.weather[0]) || null;
  const moonPhase = best.moon_phase;
  const moonPhaseLabel =
    moonPhase != null ? (hawaiianMoonPhaseLabel(moonPhase) ?? undefined) : undefined;
  return {
    timezone: json.timezone,
    forecast: {
      dt: best.dt,
      temp: best.temp?.day != null ? best.temp.day : (json.current?.temp ?? 0),
      humidity: best.humidity,
      weather,
      moonPhase,
      moonPhaseLabel,
    },
  };
}
