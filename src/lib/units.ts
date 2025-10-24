// Unit normalization and conversions used across the app

export type CanonicalUnit = 'count' | 'g' | 'kg' | 'lb' | 'oz'

export function normalizeUnit(unit: string | null | undefined): CanonicalUnit | null {
  if (!unit) return null
  const s = unit.trim().toLowerCase()
  if (s === 'count') return 'count'
  if (s === 'g' || s === 'gram' || s === 'grams') return 'g'
  if (s === 'kg' || s === 'kilogram' || s === 'kilograms') return 'kg'
  if (s === 'lb' || s === 'lbs' || s === 'pound' || s === 'pounds') return 'lb'
  if (s === 'oz' || s === 'ounce' || s === 'ounces') return 'oz'
  return null
}

export function isWeightUnit(unit: string | null | undefined): boolean {
  const u = normalizeUnit(unit)
  return u !== null && u !== 'count'
}

export function isCountUnit(unit: string | null | undefined): boolean {
  const u = normalizeUnit(unit)
  return u === null || u === 'count'
}

export function toGrams(qty: number, unit: string | null | undefined): number {
  const u = normalizeUnit(unit)
  if (u === 'g' || u === null) return qty
  if (u === 'kg') return qty * 1000
  if (u === 'lb') return qty * 453.59237
  if (u === 'oz') return qty * 28.349523125
  // count and unknown units should not be converted; return as-is
  return qty
}


