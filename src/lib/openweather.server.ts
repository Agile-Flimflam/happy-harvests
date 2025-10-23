import { getOpenWeatherIntegration } from './integrations'
import { hawaiianMoonPhaseLabel, lunarPhaseFraction } from './hawaiian-moon'

export type FetchWeatherOptions = {
  units?: 'imperial' | 'metric'
}

type OpenWeatherOneCall = {
  timezone: string
  current: {
    dt: number
    sunrise?: number
    sunset?: number
    temp: number
    humidity: number
    weather?: Array<{ id: number; main: string; description: string; icon: string }>
  }
  daily?: Array<{ moon_phase?: number }>
}

export async function fetchWeatherByCoords(
  latitude: number,
  longitude: number,
  options: FetchWeatherOptions = {}
): Promise<{
  timezone: string
  current: {
    dt: number
    sunrise?: number
    sunset?: number
    temp: number
    humidity: number
    weather: { id: number; main: string; description: string; icon: string } | null
  }
  moonPhase?: number
  moonPhaseLabel?: string
}> {
  const { apiKey, enabled } = await getOpenWeatherIntegration()
  if (!enabled || !apiKey) {
    throw new Error('OpenWeather integration is not configured')
  }

  const url = new URL('https://api.openweathermap.org/data/3.0/onecall')
  url.searchParams.set('lat', String(latitude))
  url.searchParams.set('lon', String(longitude))
  url.searchParams.set('exclude', 'minutely,hourly,alerts')
  url.searchParams.set('appid', apiKey)
  url.searchParams.set('units', options.units === 'metric' ? 'metric' : 'imperial')

  const res = await fetch(url.toString(), { method: 'GET', cache: 'no-store' })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(text || res.statusText)
  }

  const json = (await res.json()) as OpenWeatherOneCall

  const currentWeather = (json.current.weather && json.current.weather[0]) || null
  let moonPhase = json.daily && json.daily[0] ? json.daily[0].moon_phase : undefined
  // Fallback: compute from current date when API omits moon phase
  if (moonPhase == null) {
    try {
      const approx = lunarPhaseFraction(new Date((json.current.dt || 0) * 1000))
      moonPhase = approx
    } catch {
      // ignore
    }
  }
  const moonPhaseLabel = moonPhase != null ? hawaiianMoonPhaseLabel(moonPhase) ?? undefined : undefined

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
  }
}


