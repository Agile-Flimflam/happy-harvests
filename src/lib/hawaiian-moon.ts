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
  // Map 0..1 to 0..29
  const idx = Math.min(29, Math.max(0, Math.floor(p * 30)))
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


