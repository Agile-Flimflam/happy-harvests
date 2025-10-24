'use client'

import { useEffect, useState } from 'react'
import { WeatherBadge } from '@/components/weather/WeatherBadge'

type Props = {
  id: string | null
  latitude: number | null
  longitude: number | null
}

type WeatherResponse = {
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
}

export default function CalendarHeaderWeather({ id, latitude, longitude }: Props) {
  const [state, setState] = useState<
    | { status: 'idle' }
    | { status: 'loading' }
    | { status: 'error'; message: string }
    | { status: 'ready'; data: WeatherResponse }
  >({ status: 'idle' })

  useEffect(() => {
    if (!id || latitude == null || longitude == null) return
    let cancelled = false
    setState({ status: 'loading' })
    fetch(`/api/locations/${id}/weather`, { cache: 'no-store' })
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.json()).error || res.statusText)
        return res.json()
      })
      .then((data: WeatherResponse) => {
        if (cancelled) return
        setState({ status: 'ready', data })
      })
      .catch((e) => {
        if (cancelled) return
        setState({ status: 'error', message: e instanceof Error ? e.message : 'Failed to load weather' })
      })
    return () => {
      cancelled = true
    }
  }, [id, latitude, longitude])

  if (id == null || latitude == null || longitude == null) {
    return <div className="text-sm text-muted-foreground">Set a location with coordinates to see weather and moon</div>
  }
  if (state.status === 'idle' || state.status === 'loading') {
    return <div className="text-sm text-muted-foreground">Loading weather…</div>
  }
  if (state.status === 'error') {
    return <div className="text-sm text-red-500">{state.message}</div>
  }

  const { current, moonPhaseLabel } = state.data
  const tempF = current.temp
  const icon = current.weather?.icon || null
  const description = current.weather?.description || null
  // Compute the same emoji used in calendar days for consistency
  function moonEmojiFromLabel(label: string | null | undefined): string | null {
    if (!label) return null
    // Rough mapping by name groups
    const l = label.toLowerCase()
    if (/(hilo|hoaka|kū|ole|olepau)/.test(l)) return '🌒'
    if (/(huna|mōhalu|hua|akua)/.test(l)) return '🌓'
    if (/(hoku|mahealani)/.test(l)) return '🌕'
    if (/(kulu|lāʻau)/.test(l)) return '🌖'
    if (/(kāloa|kāne|lono)/.test(l)) return '🌗'
    if (/(mauli)/.test(l)) return '🌘'
    if (/(muku)/.test(l)) return '🌑'
    return '🌙'
  }
  const moonEmoji = moonEmojiFromLabel(moonPhaseLabel)

  return (
    <div className="flex items-center gap-4 text-sm rounded-md bg-muted/40 px-3 py-2">
      <WeatherBadge
        icon={icon}
        tempF={tempF}
        description={description}
        inlineDescription
        hawaiianMoon={moonPhaseLabel}
        moonEmoji={moonEmoji}
        size="sm"
      />
    </div>
  )
}


