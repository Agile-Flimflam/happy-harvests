'use client'

import * as React from 'react'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { Droplet, Sprout, Wrench, Bug, FlaskConical, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, CalendarDays, ShoppingBasket, Calendar, CalendarRange } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { CalendarEvent, CalendarFilter, CalendarLocation } from './types'
import { Dialog } from '@/components/ui/dialog'
import { DayCell } from './_components/DayCell'
import { DayDetailDialog } from './_components/DayDetailDialog'

// moonEmojiForDate now imported from '@/lib/hawaiian-moon'

// UTC helpers and string-only date math (YYYY-MM-DD)
const pad2 = (n: number): string => String(n).padStart(2, '0')
const isoFromYMD = (y: number, m1: number, d: number): string => `${y}-${pad2(m1)}-${pad2(d)}`
const parseISO = (iso: string): { y: number; m1: number; d: number } => {
  const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/
  const fallbackToTodayUTC = (): { y: number; m1: number; d: number } => {
    const now = new Date()
    return { y: now.getUTCFullYear(), m1: now.getUTCMonth() + 1, d: now.getUTCDate() }
  }

  if (!isoDatePattern.test(iso)) {
    console.warn('parseISO: invalid format, expected YYYY-MM-DD. Received:', iso)
    return fallbackToTodayUTC()
  }

  const [yStr, mStr, dStr] = iso.split('-')
  const y = Number(yStr)
  const m1 = Number(mStr)
  const d = Number(dStr)

  if (!Number.isFinite(y) || !Number.isFinite(m1) || !Number.isFinite(d)) {
    console.warn('parseISO: non-numeric components in input:', iso)
    return fallbackToTodayUTC()
  }

  if (m1 < 1 || m1 > 12 || d < 1 || d > 31) {
    console.warn('parseISO: out-of-range month/day in input:', iso)
    return fallbackToTodayUTC()
  }

  // Validate against UTC date to catch invalid calendar dates (e.g., 2023-02-30)
  const dt = new Date(Date.UTC(y, m1 - 1, d))
  if (dt.getUTCFullYear() !== y || (dt.getUTCMonth() + 1) !== m1 || dt.getUTCDate() !== d) {
    console.warn('parseISO: invalid calendar date in input:', iso)
    return fallbackToTodayUTC()
  }

  return { y, m1, d }
}
const utcTimeValueFromISO = (iso: string): number => {
  const { y, m1, d } = parseISO(iso)
  return Date.UTC(y, m1 - 1, d)
}
const addDaysISO = (iso: string, deltaDays: number): string => {
  const t = utcTimeValueFromISO(iso)
  const d = new Date(t)
  d.setUTCDate(d.getUTCDate() + deltaDays)
  return isoFromYMD(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate())
}
const weekStartISO = (iso: string): string => {
  const t = utcTimeValueFromISO(iso)
  const d = new Date(t)
  const dow = d.getUTCDay() // 0 = Sunday
  d.setUTCDate(d.getUTCDate() - dow)
  return isoFromYMD(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate())
}
const startOfMonthUTC = (y: number, mZeroBased: number): string => isoFromYMD(y, mZeroBased + 1, 1)
const monthGridStartISO = (y: number, mZeroBased: number): string => weekStartISO(startOfMonthUTC(y, mZeroBased))
/**
 * Convert an ISO date string (YYYY-MM-DD) to a Date at local midnight.
 *
 * All calendar calculations are performed in UTC to avoid DST issues.
 * This helper returns a local-midnight Date only for UI rendering
 * in components that expect local Date instances.
 */
const toLocalMidnightDate = (iso: string): Date => new Date(iso + 'T00:00:00')

export default function CalendarClient({ events, locations = [] }: { events: CalendarEvent[]; locations?: Array<CalendarLocation> }) {

  // Today in UTC ISO (kept fresh across midnight UTC)
  const [todayISO, setTodayISO] = React.useState<string>(() => {
    const nowInit = new Date()
    return isoFromYMD(nowInit.getUTCFullYear(), nowInit.getUTCMonth() + 1, nowInit.getUTCDate())
  })
  const [current, setCurrent] = React.useState<{ y: number; m: number }>(() => {
    const { y, m1 } = parseISO(todayISO)
    return { y, m: m1 - 1 }
  })
  const [filter, setFilter] = React.useState<CalendarFilter>('all')
  const [detail, setDetail] = React.useState<{ open: boolean; date: string | null }>({ open: false, date: null })
  const [range, setRange] = React.useState<'month' | 'week' | 'today'>('month')

  React.useEffect(() => {
    try { window.localStorage.setItem('calendar.filter', filter) } catch (e) {
      console.warn('Failed to persist calendar.filter to localStorage', e)
    }
  }, [filter])
  React.useEffect(() => {
    try { window.localStorage.setItem('calendar.range', range) } catch (e) {
      console.warn('Failed to persist calendar.range to localStorage', e)
    }
  }, [range])
  React.useEffect(() => {
    // Load persisted settings on client after mount to avoid SSR hydration mismatch
    try {
      const storedFilter = window.localStorage.getItem('calendar.filter') as CalendarFilter | null
      if (storedFilter === 'all' || storedFilter === 'activity' || storedFilter === 'planting' || storedFilter === 'harvest') setFilter(storedFilter)
      const storedRange = window.localStorage.getItem('calendar.range') as 'month' | 'week' | 'today' | null
      if (storedRange === 'month' || storedRange === 'week' || storedRange === 'today') setRange(storedRange)
    } catch (e) {
      console.warn('Failed to load persisted calendar settings from localStorage', e)
    }
  }, [])

  // Keep todayISO fresh with a single timeout scheduled for next UTC midnight (no polling)
  React.useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout> | undefined
    let cancelled = false
    const update = () => {
      const now = new Date()
      const iso = isoFromYMD(now.getUTCFullYear(), now.getUTCMonth() + 1, now.getUTCDate())
      setTodayISO((prev) => (prev === iso ? prev : iso))
    }
    const scheduleNext = () => {
      if (cancelled) return
      const now = new Date()
      const nextUtcMidnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0, 0))
      const delayMs = Math.max(0, nextUtcMidnight.getTime() - now.getTime())
      timeoutId = setTimeout(() => {
        if (cancelled) return
        update()
        if (cancelled) return
        scheduleNext()
      }, delayMs)
    }
    // Ensure we are correct on mount, then schedule to next midnight
    update()
    scheduleNext()
    return () => {
      cancelled = true
      if (timeoutId !== undefined) clearTimeout(timeoutId)
    }
  }, [])

  // Focused date for week/day navigation
  const [focusDateISO, setFocusDateISO] = React.useState<string>(() => todayISO)
  React.useEffect(() => {
    if (range === 'today') {
      setDetail({ open: true, date: focusDateISO })
    }
  }, [range, focusDateISO])

  // When day rolls over (UTC) and user is on 'today' view, keep focus/current in sync
  React.useEffect(() => {
    if (range === 'today') {
      const { y, m1 } = parseISO(todayISO)
      setFocusDateISO(todayISO)
      setCurrent({ y, m: m1 - 1 })
    }
  }, [todayISO, range])

  // Memoized UTC times to avoid repeated parsing during filters
  const focusDateUTC = React.useMemo(() => utcTimeValueFromISO(focusDateISO), [focusDateISO])
  const weekRangeUTC = React.useMemo(() => {
    const startISO = weekStartISO(focusDateISO)
    const start = utcTimeValueFromISO(startISO)
    const end = utcTimeValueFromISO(addDaysISO(startISO, 6))
    return { start, end }
  }, [focusDateISO])

  // Navigation helpers (used by buttons and swipe)
  const navigatePrev = React.useCallback(() => {
    if (range === 'today') {
      const nextISO = addDaysISO(focusDateISO, -1)
      const { y, m1 } = parseISO(nextISO)
      setFocusDateISO(nextISO)
      setCurrent({ y, m: m1 - 1 })
    } else if (range === 'week') {
      const nextISO = addDaysISO(focusDateISO, -7)
      const { y, m1 } = parseISO(nextISO)
      setFocusDateISO(nextISO)
      setCurrent({ y, m: m1 - 1 })
    } else {
      setCurrent(({ y, m }) => (m === 0 ? { y: y-1, m: 11 } : { y, m: m-1 }))
    }
  }, [range, focusDateISO])

  const navigateNext = React.useCallback(() => {
    if (range === 'today') {
      const nextISO = addDaysISO(focusDateISO, 1)
      const { y, m1 } = parseISO(nextISO)
      setFocusDateISO(nextISO)
      setCurrent({ y, m: m1 - 1 })
    } else if (range === 'week') {
      const nextISO = addDaysISO(focusDateISO, 7)
      const { y, m1 } = parseISO(nextISO)
      setFocusDateISO(nextISO)
      setCurrent({ y, m: m1 - 1 })
    } else {
      setCurrent(({ y, m }) => (m === 11 ? { y: y+1, m: 0 } : { y, m: m+1 }))
    }
  }, [range, focusDateISO])

  // Keep header (month/year) in sync with focused date for today/week
  React.useEffect(() => {
    if (range !== 'month') {
      const { y, m1 } = parseISO(focusDateISO)
      setCurrent({ y, m: m1 - 1 })
    }
  }, [range, focusDateISO])

  const handleTodayClick = React.useCallback(() => {
    const { y, m1 } = parseISO(todayISO)
    setCurrent({ y, m: m1 - 1 })
    setFocusDateISO(todayISO)
  }, [todayISO])

  // Build cells from ISO math; render using local-midnight Dates for UI components
  const cells: Array<{ iso: string; dateLocal: Date }> = React.useMemo(() => {
    if (range === 'today') {
      const iso = focusDateISO
      return [{ iso, dateLocal: toLocalMidnightDate(iso) }]
    }
    if (range === 'week') {
      const startISO = weekStartISO(focusDateISO)
      return Array.from({ length: 7 }, (_, i) => {
        const iso = addDaysISO(startISO, i)
        return { iso, dateLocal: toLocalMidnightDate(iso) }
      })
    }
    // month grid (6 weeks)
    const startISO = monthGridStartISO(current.y, current.m)
    return Array.from({ length: 42 }, (_, i) => {
      const iso = addDaysISO(startISO, i)
      return { iso, dateLocal: toLocalMidnightDate(iso) }
    })
  }, [range, focusDateISO, current.y, current.m])

  const inSelectedRange = React.useCallback((dateISO: string): boolean => {
    if (range === 'today') {
      return utcTimeValueFromISO(dateISO) === focusDateUTC
    }
    if (range === 'week') {
      const t = utcTimeValueFromISO(dateISO)
      return t >= weekRangeUTC.start && t <= weekRangeUTC.end
    }
    return true
  }, [range, focusDateUTC, weekRangeUTC])

  // Header label derived in UTC to avoid DST issues
  const headerLabel = React.useMemo(() => {
    const d = new Date(Date.UTC(current.y, current.m, 1))
    return d.toLocaleString(undefined, { month: 'long', year: 'numeric', timeZone: 'UTC' })
  }, [current.y, current.m])

  const filtered = (filter === 'all' ? events : events.filter((e) => e.type === filter)).filter((e) => inSelectedRange(e.start))
  const byDay = new Map<string, CalendarEvent[]>()
  for (const e of filtered) {
    const day = e.start.slice(0,10)
    if (!byDay.has(day)) byDay.set(day, [])
    byDay.get(day)!.push(e)
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setCurrent(({ y, m }) => ({ y: y-1, m }))} aria-label="Previous year">
            <ChevronsLeft className="mr-1 h-4 w-4" /> Year
          </Button>
          <Button variant="outline" size="sm" onClick={navigatePrev} aria-label="Previous">
            <ChevronLeft className="mr-1 h-4 w-4" /> Prev
          </Button>
          <div className="font-semibold text-lg">{headerLabel}</div>
          <Button variant="outline" size="sm" onClick={navigateNext} aria-label="Next">
            Next <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setCurrent(({ y, m }) => ({ y: y+1, m }))} aria-label="Next year">
            Year <ChevronsRight className="ml-1 h-4 w-4" />
          </Button>
          <Button variant="secondary" size="sm" className="ml-2 hidden sm:inline-flex" onClick={handleTodayClick}>
            <CalendarDays className="mr-1 h-4 w-4" /> Today
          </Button>
        </div>
        {/* Mobile compact filter menu */}
        <div className="w-full md:hidden sticky top-0 z-10 bg-background/95 supports-[backdrop-filter]:bg-background/60 backdrop-blur rounded-md px-1 py-1 flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="border rounded px-2 py-1 text-xs hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring/40">Filters</button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-[16rem]">
              <div className="px-3 py-2 text-[11px] uppercase tracking-wide text-muted-foreground/80 border-b">Type</div>
              {(['all','activity','planting','harvest'] as const).map((v) => {
                const label = v === 'all' ? 'All' : v === 'activity' ? 'Activities' : v === 'planting' ? 'Plantings' : 'Harvests'
                const Icon = v === 'all' ? CalendarDays : v === 'activity' ? Wrench : v === 'planting' ? Sprout : ShoppingBasket
                return (
                  <DropdownMenuItem key={v} onClick={() => setFilter(v)} className={filter===v ? 'bg-accent/60 focus:bg-accent/60' : ''}>
                    <span className="inline-flex items-center gap-2">
                      <Icon className="h-4 w-4" />
                      <span>{label}</span>
                    </span>
                  </DropdownMenuItem>
                )
              })}
              <div className="px-3 py-2 text-[11px] uppercase tracking-wide text-muted-foreground/80 border-y">Range</div>
              {(['month','week','today'] as const).map((v) => {
                const label = v[0].toUpperCase() + v.slice(1)
                const Icon = v === 'month' ? Calendar : v === 'week' ? CalendarRange : CalendarDays
                return (
                  <DropdownMenuItem key={v} onClick={() => setRange(v)} className={range===v ? 'bg-accent/60 focus:bg-accent/60' : ''}>
                    <span className="inline-flex items-center gap-2">
                      <Icon className="h-4 w-4" />
                      <span>{label}</span>
                    </span>
                  </DropdownMenuItem>
                )
              })}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="secondary" size="sm" className="ml-auto" onClick={handleTodayClick}>
            <CalendarDays className="mr-1 h-4 w-4" /> Today
          </Button>
        </div>
        {/* Desktop/tablet filter row (wraps; no sticky to avoid overlap) */}
        <div className="hidden md:flex w-full px-1 py-1 items-center gap-3 flex-wrap mt-1">
          <div className="flex items-center gap-1 sm:gap-2 flex-nowrap" role="tablist" aria-label="Filter">
            {(['all','activity','planting','harvest'] as const).map((v) => (
              <button key={v} role="tab" aria-selected={filter===v} className={`rounded px-2 py-1 text-xs sm:text-sm whitespace-nowrap border transition-colors active:scale-95 ${filter===v ? 'bg-accent text-accent-foreground' : 'bg-background hover:bg-accent/40'} focus-visible:ring-2 focus-visible:ring-ring/40`} onClick={() => setFilter(v)}>
                {v === 'all' ? 'All' : v === 'activity' ? 'Activities' : v === 'planting' ? 'Plantings' : 'Harvests'}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1 sm:gap-2 flex-nowrap" role="tablist" aria-label="Range">
            {(['month','week','today'] as const).map((v) => (
              <button key={v} role="tab" aria-selected={range===v} className={`rounded px-2 py-1 text-xs sm:text-sm whitespace-nowrap border transition-colors active:scale-95 ${range===v ? 'bg-accent text-accent-foreground' : 'bg-background hover:bg-accent/40'} focus-visible:ring-2 focus-visible:ring-ring/40`} onClick={() => setRange(v)}>
                {v[0].toUpperCase() + v.slice(1)}
              </button>
            ))}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="border rounded px-2 py-1 text-xs sm:text-sm hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring/40 hidden sm:inline-block">Legend</button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64 p-2">
              <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs text-foreground">
                <div className="inline-flex items-center gap-2"><Droplet className="size-3 text-blue-600" /> Irrigation</div>
                <div className="inline-flex items-center gap-2"><FlaskConical className="size-3 text-amber-700" /> Soil amend.</div>
                <div className="inline-flex items-center gap-2"><Bug className="size-3 text-rose-700" /> Pest mgmt.</div>
                <div className="inline-flex items-center gap-2"><Wrench className="size-3 text-violet-700" /> Maintenance</div>
                <div className="inline-flex items-center gap-2"><span className="inline-block size-2 rounded-full bg-yellow-500" /> Nursery</div>
                <div className="inline-flex items-center gap-2"><span className="inline-block size-2 rounded-full bg-green-600" /> Planted</div>
                <div className="inline-flex items-center gap-2"><span className="inline-block size-2 rounded-full bg-emerald-600" /> Harvested</div>
                <div className="inline-flex items-center gap-2"><span className="inline-block size-2 rounded-full bg-slate-500" /> Removed</div>
                <div className="inline-flex items-center gap-2"><ShoppingBasket className="size-3 text-emerald-700" /> Harvest</div>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      {/* Legend now in dropdown to reduce visual noise */}
      <div className={`grid ${range==='week' ? 'grid-cols-7' : range==='today' ? 'grid-cols-1' : 'grid-cols-7'} gap-2`}>
        {(() => {
          const names = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"]
          if (range === 'today') {
            const d = toLocalMidnightDate(focusDateISO)
            return <div className="text-xs text-muted-foreground px-1">{names[d.getDay()]}</div>
          }
          return names.map((d) => (<div key={d} className="text-xs text-muted-foreground px-1">{d}</div>))
        })()}
        {cells.map(({ iso, dateLocal }) => {
          const key = iso
          const dayEventsRaw = byDay.get(iso) || []
          const eventsWithPriority = dayEventsRaw.map((e) => ({
            e,
            p: e.type === 'harvest' ? 0 : e.type === 'planting' ? 1 : 2,
          }))
          eventsWithPriority.sort((a, b) => {
            if (a.p !== b.p) return a.p - b.p
            return (a.e.title || '').localeCompare(b.e.title || '')
          })
          const dayEvents = eventsWithPriority.map(({ e }) => e)
          return (
            <DayCell
              key={key}
              date={dateLocal}
              currentMonth={current.m}
              today={toLocalMidnightDate(todayISO)}
              onOpenDetail={(dateISO) => setDetail({ open: true, date: dateISO })}
              events={dayEvents}
            />
          )
        })}
      </div>
      <Dialog open={detail.open} onOpenChange={(open) => setDetail((d) => ({ open, date: open ? d.date : null }))}>
        <DayDetailDialog
          dateISO={detail.date ?? ''}
          events={detail.date ? byDay.get(detail.date) || [] : []}
          locations={locations.filter((l) => l.latitude != null && l.longitude != null)}
          onPrev={() => {
            if (!detail.date) return
            const prevISO = addDaysISO(detail.date, -1)
            setDetail({ open: true, date: prevISO })
          }}
          onNext={() => {
            if (!detail.date) return
            const nextISO = addDaysISO(detail.date, 1)
            setDetail({ open: true, date: nextISO })
          }}
        />
      </Dialog>
    </div>
  )
}


