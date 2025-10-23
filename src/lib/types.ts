import type { Tables } from '@/lib/supabase-server'

export type PlantingWithDetails = Tables<'plantings'> & {
  crop_varieties: { name: string; latin_name: string; crops: { name: string } | null } | null
  beds: {
    id: number
    length_inches: number | null
    width_inches: number | null
    plots: { locations: { name: string } | null } | null
  } | null
  nurseries: { name: string } | null
  planted_qty?: number | null
  planted_weight_grams?: number | null
  harvest_qty?: number | null
  harvest_weight_grams?: number | null
}


