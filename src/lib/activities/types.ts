import type { Enums } from '@/lib/database.types'

export type ActivityType = Enums<'activity_type'>

export const ACTIVITY_TYPES = [
  'irrigation',
  'soil_amendment',
  'pest_management',
  'asset_maintenance',
] as const satisfies readonly ActivityType[]

export const ACTIVITY_TYPE_LABELS: Record<ActivityType, string> = {
  irrigation: 'Irrigation',
  soil_amendment: 'Soil Amendment',
  pest_management: 'Pest Management',
  asset_maintenance: 'Asset Maintenance',
}

export const ACTIVITY_TYPE_OPTIONS = ACTIVITY_TYPES.map((value) => ({
  value,
  label: ACTIVITY_TYPE_LABELS[value],
}))

// Mutable tuple for libraries (e.g., zod) that require a non-readonly tuple
export const ACTIVITY_TYPES_ENUM = [...ACTIVITY_TYPES] as [
  ActivityType,
  ...ActivityType[]
]

export function isActivityType(v: unknown): v is ActivityType {
  return typeof v === 'string' && (ACTIVITY_TYPES as readonly string[]).includes(v)
}

export function prettyActivityType(t: ActivityType) {
  return ACTIVITY_TYPE_LABELS[t]
}

type Missing = Exclude<ActivityType, (typeof ACTIVITY_TYPES)[number]>
export const __assertAllActivityTypesCovered: Missing extends never ? true : never = true
