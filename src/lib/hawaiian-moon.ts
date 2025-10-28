// Full Hawaiian moon phase names and recommended mahiʻai activities (30 nights)
// Sourced from user-provided list; grouped by anahulu periods.
type MoonInfo = { name: string; recommendation: string; anahulu: 'Hoʻonui' | 'Poepoe' | 'Emi' }

const MOON_TABLE: MoonInfo[] = [
  { name: 'Hilo', recommendation: 'No Planting. Prepare soil, weed, gather materials.', anahulu: 'Hoʻonui' },
  { name: 'Hoaka', recommendation: 'No Planting. Continue weeding and soil preparation.', anahulu: 'Hoʻonui' },
  { name: 'Kū Kahi', recommendation: 'Good Planting. Plant upright crops (kō/sugarcane, maiʻa/banana).', anahulu: 'Hoʻonui' },
  { name: 'Kū Lua', recommendation: 'Good Planting. Plant upright crops (kō, maiʻa).', anahulu: 'Hoʻonui' },
  { name: 'Kū Kolu', recommendation: 'Good Planting. Plant upright crops (kō, maiʻa).', anahulu: 'Hoʻonui' },
  { name: 'Kū Pau', recommendation: 'Good Planting. Plant upright crops (kō, maiʻa).', anahulu: 'Hoʻonui' },
  { name: 'ʻOlekūkahi', recommendation: 'No Planting. Weed, rest, mend tools.', anahulu: 'Hoʻonui' },
  { name: 'ʻOlekūlua', recommendation: 'No Planting. Good day for weeding (weeds will not grow back).', anahulu: 'Hoʻonui' },
  { name: 'ʻOlekūkolu', recommendation: 'No Planting. Continue weeding and field preparation.', anahulu: 'Hoʻonui' },
  { name: 'ʻOlepau', recommendation: 'No Planting. Finish weeding.', anahulu: 'Hoʻonui' },
  { name: 'Huna', recommendation: 'Excellent Planting. Plant root crops that hide (ʻuala, kalo).', anahulu: 'Poepoe' },
  { name: 'Mōhalu', recommendation: 'Excellent Planting. Plant flowers and anything that should flourish.', anahulu: 'Poepoe' },
  { name: 'Hua', recommendation: 'Most Fertile. Plant anything that bears fruit (ipu, ʻuala, kalo).', anahulu: 'Poepoe' },
  { name: 'Akua', recommendation: 'Excellent Planting. Very fertile day for all food crops.', anahulu: 'Poepoe' },
  { name: 'Hoku', recommendation: 'Excellent Planting. Very fertile day for all food crops (full moon).', anahulu: 'Poepoe' },
  { name: 'Mahealani', recommendation: 'Excellent Planting. Very fertile day for all food crops (true full moon).', anahulu: 'Poepoe' },
  { name: 'Kulu', recommendation: 'Good Planting. Plant crops that hang or drip (vines, ipu).', anahulu: 'Poepoe' },
  { name: 'Lāʻau Kū Kahi', recommendation: 'Good Planting. Especially for medicinal plants and trees.', anahulu: 'Poepoe' },
  { name: 'Lāʻau Kū Lua', recommendation: 'Good Planting. Especially for medicinal plants and trees.', anahulu: 'Poepoe' },
  { name: 'Lāʻau Pau', recommendation: 'Good Planting. Last productive day of this period.', anahulu: 'Poepoe' },
  { name: 'ʻOlekūkahi', recommendation: 'No Planting. Weed, pest control, clear land.', anahulu: 'Emi' },
  { name: 'ʻOlekūlua', recommendation: 'No Planting. Good day to weed.', anahulu: 'Emi' },
  { name: 'ʻOlepau', recommendation: 'No Planting. Finish weeding.', anahulu: 'Emi' },
  { name: 'Kāloa Kū Kahi', recommendation: 'Good Planting. Plant things that grow long (vines, runners, wauke).', anahulu: 'Emi' },
  { name: 'Kāloa Kū Lua', recommendation: 'Good Planting. Plant things that grow long (vines, runners).', anahulu: 'Emi' },
  { name: 'Kāloa Pau', recommendation: 'Good Planting. Plant things that grow long (vines, runners).', anahulu: 'Emi' },
  { name: 'Kāne', recommendation: 'Excellent Planting. Sacred day for planting all food crops (kalo, kō, ʻuala).', anahulu: 'Emi' },
  { name: 'Lono', recommendation: 'Excellent Planting. Sacred day for planting food crops (especially fruit crops).', anahulu: 'Emi' },
  { name: 'Mauli', recommendation: 'No Planting. Low energy. Rest, light weeding, prepare fields.', anahulu: 'Emi' },
  { name: 'Muku', recommendation: 'No Planting. Dark moon. A day of complete rest.', anahulu: 'Emi' },
]

export function hawaiianMoonPhaseLabel(phase0to1: number | null | undefined): string | null {
  const info = hawaiianMoonInfo(phase0to1)
  return info?.name ?? null
}

export function hawaiianMoonInfo(phase0to1: number | null | undefined): MoonInfo | null {
  if (phase0to1 == null) return null
  const p = ((phase0to1 % 1) + 1) % 1
  // Map 0..1 to 0..29 using nearest-night rounding with proper wrap-around
  // The +0.5 and floor implements rounding; modulo 30 wraps 30 -> 0 to avoid overweighting the last bin
  const idx = Math.floor(p * 30 + 0.5) % 30
  return MOON_TABLE[idx]
}

// Rough lunar phase fraction for a given date (0=new, 0.5=full).
export function lunarPhaseFraction(date: Date): number {
  const synodic = 29.530588853 * 86400 // seconds
  // Reference new moon: 2000-01-06 18:14 UTC
  const ref = Date.UTC(2000, 0, 6, 18, 14) / 1000
  const now = date.getTime() / 1000
  const phase = ((now - ref) % synodic + synodic) % synodic
  return phase / synodic
}

// Compute the lunar phase fraction using the date at local noon for the supplied IANA time zone.
// This avoids day-boundary drift from UTC vs local day.
export function lunarPhaseFractionAtLocalNoon(baseDateUtc: Date, timeZone: string): number {
  try {
    const noonLocal = dateAtLocalNoon(baseDateUtc, timeZone)
    return lunarPhaseFraction(noonLocal)
  } catch {
    return lunarPhaseFraction(baseDateUtc)
  }
}

/**
 * Computes the offset, in milliseconds, between UTC and the specified IANA
 * time zone for the given UTC date. A positive value indicates the local time
 * zone is ahead of UTC at that instant; negative indicates it is behind.
 *
 * @param dateUtc - A Date representing an instant in UTC.
 * @param timeZone - IANA time zone identifier (e.g., 'Pacific/Honolulu').
 * @returns The millisecond offset to add to UTC to obtain local wall-clock time.
 */
function timeZoneOffsetMs(dateUtc: Date, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
  const parts = dtf.formatToParts(dateUtc)
  const map: Record<string, string> = {}
  for (const p of parts) {
    if (p.type !== 'literal') map[p.type] = p.value
  }
  const asLocalEpochMs = Date.UTC(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day),
    Number(map.hour),
    Number(map.minute),
    Number(map.second)
  )
  return asLocalEpochMs - dateUtc.getTime()
}

/**
 * Returns a Date representing local noon (12:00) in the specified IANA time zone
 * for the same calendar day as the provided baseDateUtc. The returned Date is
 * constructed in UTC milliseconds corresponding to that local-noon instant.
 *
 * Example: If baseDateUtc is 2025-10-24T03:15Z and timeZone is 'Pacific/Honolulu',
 * this function returns the UTC instant that corresponds to 12:00 on 2025-10-23 in Honolulu.
 *
 * @param baseDateUtc - A Date (UTC) whose calendar day is used to determine local noon.
 * @param timeZone - IANA time zone identifier (e.g., 'Pacific/Honolulu').
 * @returns Date at local noon for the given time zone and calendar day of baseDateUtc.
 */
function dateAtLocalNoon(baseDateUtc: Date, timeZone: string): Date {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const parts = dtf.formatToParts(baseDateUtc)
  const map: Record<string, string> = {}
  for (const p of parts) {
    if (p.type !== 'literal') map[p.type] = p.value
  }
  const noonUtcDate = new Date(Date.UTC(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day),
    12, 0, 0
  ))
  const noonLocalAsUtcMs = Date.UTC(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day),
    12, 0, 0
  ) - timeZoneOffsetMs(noonUtcDate, timeZone)
  return new Date(noonLocalAsUtcMs)
}

export function hawaiianMoonForDate(date: Date): { name: string; recommendation: string } | null {
  const info = hawaiianMoonInfo(lunarPhaseFraction(date))
  return info ? { name: info.name, recommendation: info.recommendation } : null
}

export function hawaiianMoonForISO(iso: string | null | undefined): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (isNaN(d.getTime())) return null
  return hawaiianMoonForDate(d)?.name ?? null
}

export function hawaiianMoonInfoForISO(iso: string | null | undefined): { name: string; recommendation: string } | null {
  if (!iso) return null
  const d = new Date(iso)
  if (isNaN(d.getTime())) return null
  return hawaiianMoonForDate(d)
}

// Lookup helpers by moon name for tooltips
export function hawaiianMoonInfoByName(name: string | null | undefined): MoonInfo | null {
  if (!name) return null
  const found = MOON_TABLE.find((m) => m.name === name)
  return found ?? null
}

export function hawaiianMoonRecommendationByName(name: string | null | undefined): string | null {
  const info = hawaiianMoonInfoByName(name)
  return info?.recommendation ?? null
}


// Shared default emoji to use when a specific mapping isn't available
export const DEFAULT_MOON_EMOJI = '🌙'

// Centralized emoji helpers to avoid duplicating logic across components
export function moonEmojiForDate(date: Date): string {
  const f = lunarPhaseFraction(date)
  if (f < 0.0625 || f >= 0.9375) return '🌑'
  if (f < 0.1875) return '🌒'
  if (f < 0.3125) return '🌓'
  if (f < 0.4375) return '🌔'
  if (f < 0.5625) return '🌕'
  if (f < 0.6875) return '🌖'
  if (f < 0.8125) return '🌗'
  return '🌘'
}

export function moonEmojiFromLabel(label: string | null | undefined): string | null {
  if (!label) return null
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


