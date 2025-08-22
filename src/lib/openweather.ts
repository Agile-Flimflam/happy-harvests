import 'server-only'

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
    weather: Array<{
      id: number
      main: string
      description: string
      icon: string
    }>
  }
}

export type WeatherResult = {
  timezone: string
  current: {
    dt: number
    sunrise?: number
    sunset?: number
    temp: number
    weather: {
      id: number
      main: string
      description: string
      icon: string
    } | null
  }
}

export async function fetchWeatherByCoords(
  latitude: number,
  longitude: number,
  options?: { units?: 'standard' | 'metric' | 'imperial' }
): Promise<WeatherResult> {
  const apiKey = process.env.OPENWEATHER_API_KEY
  if (!apiKey) throw new Error('Missing OPENWEATHER_API_KEY')

  const units = options?.units ?? 'imperial'
  const exclude = 'minutely,hourly,daily,alerts'

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

  return {
    timezone: data.timezone,
    current: {
      dt: data.current.dt,
      sunrise: data.current.sunrise,
      sunset: data.current.sunset,
      temp: data.current.temp,
      weather: data.current.weather?.[0] ?? null,
    },
  }
}



