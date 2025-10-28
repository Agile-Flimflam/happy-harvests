// Date utilities shared across the app

// Adds a number of days to a YYYY-MM-DD string assuming a UTC midnight base,
// returning a new YYYY-MM-DD string in UTC.
export function addDaysUtc(dateISO: string, days: number): string {
  const dt = new Date(dateISO + 'T00:00:00Z')
  dt.setUTCDate(dt.getUTCDate() + days)
  return dt.toISOString().slice(0, 10)
}


