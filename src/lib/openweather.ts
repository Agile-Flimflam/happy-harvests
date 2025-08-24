import 'server-only'
import { getOpenWeatherIntegration } from '@/lib/integrations'

const OPENWEATHER_BASE_URL = 'https://api.openweathermap.org/data/3.0/onecall'

export type OpenWeatherMinimal = {
  timezone: string
  timezone_offset: number
  lat: number
  lon: number
  current: {
    dt: number
    sunrise?: number
    sunset?: number
    temp: number
    humidity: number
    weather: Array<{
      id: number
      main: string
      description: string
      icon: string
    }>
  }
  daily?: Array<{
    moon_phase: number
  }>
}

export type WeatherResult = {
  timezone: string
  current: {
    dt: number
    sunrise?: number
    sunset?: number
    temp: number
    humidity: number
    weather: {
      id: number
      main: string
      description: string
      icon: string
    } | null
  }
  moonPhase?: number
  moonPhaseLabel?: string
}

export async function fetchWeatherByCoords(
  latitude: number,
  longitude: number,
  options?: { units?: 'standard' | 'metric' | 'imperial'; apiKey?: string }
): Promise<WeatherResult> {
  // Resolve API key: explicit > integration (if enabled) > env var
  let apiKey = options?.apiKey ?? null
  if (!apiKey) {
    const integration = await getOpenWeatherIntegration()
    if (integration.enabled && integration.apiKey) {
      apiKey = integration.apiKey
    }
  }
  if (!apiKey) throw new Error('OpenWeather integration is disabled or missing API key')

  const units = options?.units ?? 'imperial'
  const exclude = 'minutely,hourly,alerts'

  const url = new URL(OPENWEATHER_BASE_URL)
  url.searchParams.set('lat', String(latitude))
  url.searchParams.set('lon', String(longitude))
  url.searchParams.set('exclude', exclude)
  url.searchParams.set('appid', apiKey)
  url.searchParams.set('units', units)

  const res = await fetch(url.toString(), {
    method: 'GET',
    // 10 minute cache is fine for server usage; can be overridden by route handlers
    next: { revalidate: 600 },
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`OpenWeather error ${res.status}: ${text || res.statusText}`)
  }
  const data = (await res.json()) as OpenWeatherMinimal

  function formatMoonPhase(phase: number) {
    const p = ((phase % 1) + 1) % 1
    const epsilon = 1e-6
    if (Math.abs(p - 0) < epsilon || Math.abs(p - 1) < epsilon) return 'New Moon'
    if (Math.abs(p - 0.25) < epsilon) return 'First Quarter'
    if (Math.abs(p - 0.5) < epsilon) return 'Full Moon'
    if (Math.abs(p - 0.75) < epsilon) return 'Last Quarter'
    if (p > 0 && p < 0.25) return 'Waxing Crescent'
    if (p > 0.25 && p < 0.5) return 'Waxing Gibbous'
    if (p > 0.5 && p < 0.75) return 'Waning Gibbous'
    return 'Waning Crescent'
  }

  return {
    timezone: data.timezone,
    current: {
      dt: data.current.dt,
      sunrise: data.current.sunrise,
      sunset: data.current.sunset,
      temp: data.current.temp,
      humidity: data.current.humidity,
      weather: data.current.weather?.[0] ?? null,
    },
    moonPhase: data.daily?.[0]?.moon_phase,
    moonPhaseLabel: data.daily?.[0]?.moon_phase != null ? formatMoonPhase(data.daily?.[0]?.moon_phase) : undefined,
  }
}



