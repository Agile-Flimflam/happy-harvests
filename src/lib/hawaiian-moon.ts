// Minimal Hawaiian moon phase label mapping based on moon phase 0..1.
// This is a simplification to provide culturally inspired labels for planning.

export function hawaiianMoonPhaseLabel(phase0to1: number | null | undefined): string | null {
  if (phase0to1 == null) return null
  const p = ((phase0to1 % 1) + 1) % 1
  // Basic segments mapped to well-known Hawaiian phase groupings (simplified)
  // New -> waxing crescent -> first quarter -> waxing gibbous -> full -> waning gibbous -> last quarter -> waning crescent
  if (p < 0.03 || p > 0.97) return 'Hilo (New Moon)'
  if (p < 0.12) return 'Hoaka'
  if (p < 0.25) return 'Kū (Waxing)'
  if (p < 0.35) return 'ʻOle Kūkahi'
  if (p < 0.45) return 'Huna'
  if (p < 0.55) return 'Mahina Piha (Full Moon)'
  if (p < 0.65) return 'Mahealani'
  if (p < 0.75) return 'Kulu (Waning)'
  if (p < 0.88) return 'ʻOlepau'
  return 'Muku (Old Moon)'
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

export function hawaiianMoonForDate(date: Date): string | null {
  return hawaiianMoonPhaseLabel(lunarPhaseFraction(date))
}

export function hawaiianMoonForISO(iso: string | null | undefined): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (isNaN(d.getTime())) return null
  return hawaiianMoonForDate(d)
}


