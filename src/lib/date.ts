// Date utilities shared across the app

// Adds a number of days to a YYYY-MM-DD string assuming a UTC midnight base,
// returning a new YYYY-MM-DD string in UTC.
export function addDaysUtc(dateISO: string, days: number): string {
  const dt = new Date(dateISO + 'T00:00:00Z')
  dt.setUTCDate(dt.getUTCDate() + days)
  return dt.toISOString().slice(0, 10)
}

// Formats a date string for local display. Accepts 'YYYY-MM-DD' or ISO strings.
export function formatDateLocal(s?: string | null): string {
  if (!s) return '—'
  const t = s.trim()
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t)
  if (m) {
    const y = Number(m[1])
    const mo = Number(m[2]) - 1
    const d = Number(m[3])
    const dt = new Date(y, mo, d)
    return isNaN(dt.getTime()) ? s : dt.toLocaleDateString()
  }
  const ts = Date.parse(t)
  if (!Number.isNaN(ts)) return new Date(ts).toLocaleDateString()
  return s
}


