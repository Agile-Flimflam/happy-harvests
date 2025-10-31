import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Return the value if it is a positive number; otherwise null.
 */
export function positiveOrNull(value?: number | null): number | null {
  return value != null && value > 0 ? value : null
}

// Area formatting helpers
// ------------------------
// Utilities to present square feet and acres with consistent rounding
// and thousands separators. Tooltip variants show higher precision.

/**
 * Format a square feet value with adaptive rounding and thousands separators.
 * - < 10,000: round to nearest whole number
 * - 10,000–99,999: round to nearest 10
 * - ≥ 100,000: round to nearest 100
 * Tooltip variant uses 2 decimal places.
 */
export function formatSquareFeet(valueSqFt: number, options?: { variant?: 'display' | 'tooltip' }): string {
  const variant = options?.variant ?? 'display'
  if (!isFinite(valueSqFt) || valueSqFt < 0) return '—'

  if (variant === 'tooltip') {
    return new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(valueSqFt)
  }

  let rounded: number
  if (valueSqFt < 10_000) {
    rounded = Math.round(valueSqFt)
  } else if (valueSqFt < 100_000) {
    rounded = Math.round(valueSqFt / 10) * 10
  } else {
    rounded = Math.round(valueSqFt / 100) * 100
  }
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(rounded)
}

/**
 * Format an acres value with adaptive precision.
 * - < 0.01 ac: return null (treat as not meaningful for display)
 * - < 10 ac: 3 decimals
 * - 10–99.99 ac: 2 decimals
 * - ≥ 100 ac: 1 decimal
 * Tooltip variant uses 5 decimals.
 */
export function formatAcres(valueAcres: number, options?: { variant?: 'display' | 'tooltip' }): string | null {
  const variant = options?.variant ?? 'display'
  if (!isFinite(valueAcres) || valueAcres < 0) return '—'

  if (variant === 'tooltip') {
    return new Intl.NumberFormat(undefined, { minimumFractionDigits: 5, maximumFractionDigits: 5 }).format(valueAcres)
  }

  if (valueAcres < 0.01) return null

  const decimals = valueAcres < 10 ? 3 : valueAcres < 100 ? 2 : 1
  return new Intl.NumberFormat(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(valueAcres)
}

/**
 * Convert square inches to square feet.
 */
export function squareInchesToSquareFeet(squareInches: number): number {
  return squareInches / 144
}

/**
 * Convert square feet to acres.
 */
export function squareFeetToAcres(squareFeet: number): number {
  return squareFeet / 43_560
}

/**
 * Parse a YYYY-MM-DD string into a local Date (midnight in local time).
 * Returns undefined for invalid input.
 */
export function parseLocalDateFromYMD(value?: string | null): Date | undefined {
  if (!value) return undefined
  const parts = value.split('-').map((s) => Number(s))
  if (parts.length !== 3) return undefined
  const [y, m, d] = parts
  if (!y || !m || !d) return undefined
  const local = new Date(y, m - 1, d)
  return Number.isNaN(local.getTime()) ? undefined : local
}
