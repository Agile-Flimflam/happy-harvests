#!/usr/bin/env ts-node
/*
  Prints Hawaiian moon names for a given month and IANA timezone.
  Usage: pnpm moon:print 2025-11 Pacific/Honolulu
*/

import { hawaiianMoonPhaseLabel, lunarPhaseFractionAtLocalNoon } from '@/lib/hawaiian-moon'

function main() {
  const [monthArg, tz = 'Pacific/Honolulu'] = process.argv.slice(2)
  if (!monthArg || !/^\d{4}-\d{2}$/.test(monthArg)) {
    console.error('Usage: pnpm moon:print YYYY-MM [IANA_TZ]')
    process.exit(1)
  }
  const [yearStr, monthStr] = monthArg.split('-')
  const year = Number(yearStr)
  const month0 = Number(monthStr) - 1
  const first = new Date(Date.UTC(year, month0, 1))
  const last = new Date(Date.UTC(year, month0 + 1, 0))

  for (let d = new Date(first); d <= last; d = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1))) {
    const phase = lunarPhaseFractionAtLocalNoon(d, tz)
    const name = hawaiianMoonPhaseLabel(phase) || ''
    const yyyy = d.toISOString().slice(0, 10)
    // eslint-disable-next-line no-console
    console.log(`${yyyy} ${name}`)
  }
}

main()


