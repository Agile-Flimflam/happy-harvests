'use client';

import * as React from 'react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import {
  Droplet,
  Sprout,
  Wrench,
  Bug,
  FlaskConical,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  CalendarDays,
  ShoppingBasket,
  Calendar,
  CalendarRange,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { CalendarEvent, CalendarFilter, CalendarLocation } from './types';
import type { WeatherSnapshot } from '../locations/actions';
import { Dialog } from '@/components/ui/dialog';
import { DayCell } from './_components/DayCell';
import { DayDetailDialog } from './_components/DayDetailDialog';
import CalendarHeaderWeather from './CalendarHeaderWeather';

// moonEmojiForDate now imported from '@/lib/hawaiian-moon'

// UTC helpers and string-only date math (YYYY-MM-DD)
const pad2 = (n: number): string => String(n).padStart(2, '0');
const CALENDAR_FILTERS: readonly CalendarFilter[] = ['all', 'activity', 'planting', 'harvest'];
const CALENDAR_RANGES: readonly ('month' | 'week' | 'today')[] = ['month', 'week', 'today'];
const isCalendarFilter = (value: unknown): value is CalendarFilter =>
  typeof value === 'string' && CALENDAR_FILTERS.some((filter) => filter === value);
const isCalendarRange = (value: unknown): value is 'month' | 'week' | 'today' =>
  typeof value === 'string' && CALENDAR_RANGES.some((range) => range === value);
const isoFromYMD = (y: number, m1: number, d: number): string => `${y}-${pad2(m1)}-${pad2(d)}`;
const parseISO = (iso: string): { y: number; m1: number; d: number } => {
  const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;
  const fallbackToTodayUTC = (): { y: number; m1: number; d: number } => {
    const now = new Date();
    return { y: now.getUTCFullYear(), m1: now.getUTCMonth() + 1, d: now.getUTCDate() };
  };

  if (!isoDatePattern.test(iso)) {
    console.error('parseISO: invalid format, expected YYYY-MM-DD. Received:', iso);
    return fallbackToTodayUTC();
  }

  const [yStr, mStr, dStr] = iso.split('-');
  const y = Number(yStr);
  const m1 = Number(mStr);
  const d = Number(dStr);

  if (!Number.isFinite(y) || !Number.isFinite(m1) || !Number.isFinite(d)) {
    console.error('parseISO: non-numeric components in input:', iso);
    return fallbackToTodayUTC();
  }

  if (m1 < 1 || m1 > 12 || d < 1 || d > 31) {
    console.error('parseISO: out-of-range month/day in input:', iso);
    return fallbackToTodayUTC();
  }

  // Validate against UTC date to catch invalid calendar dates (e.g., 2023-02-30)
  const dt = new Date(Date.UTC(y, m1 - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() + 1 !== m1 || dt.getUTCDate() !== d) {
    console.error('parseISO: invalid calendar date in input:', iso);
    return fallbackToTodayUTC();
  }

  return { y, m1, d };
};
const utcTimeValueFromISO = (iso: string): number => {
  const { y, m1, d } = parseISO(iso);
  return Date.UTC(y, m1 - 1, d);
};
const addDaysISO = (iso: string, deltaDays: number): string => {
  const t = utcTimeValueFromISO(iso);
  const d = new Date(t);
  d.setUTCDate(d.getUTCDate() + deltaDays);
  return isoFromYMD(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
};
const weekStartISO = (iso: string): string => {
  const t = utcTimeValueFromISO(iso);
  const d = new Date(t);
  const dow = d.getUTCDay(); // 0 = Sunday
  d.setUTCDate(d.getUTCDate() - dow);
  return isoFromYMD(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
};
const startOfMonthUTC = (y: number, mZeroBased: number): string => isoFromYMD(y, mZeroBased + 1, 1);
const monthGridStartISO = (y: number, mZeroBased: number): string =>
  weekStartISO(startOfMonthUTC(y, mZeroBased));
const dateOnlyFromISO = (iso: string): string => iso.slice(0, 10);
/**
 * Convert an ISO date string (YYYY-MM-DD) to a Date at local midnight.
 *
 * Note: This relies on JavaScript's parsing of a datetime string without a
 * timezone (YYYY-MM-DDTHH:mm:ss) as local time. By appending 'T00:00:00', the
 * resulting Date represents 00:00:00 in the user's local timezone for the
 * provided calendar date.
 *
 * All calendar calculations are performed in UTC to avoid DST issues. This
 * helper returns a local-midnight Date strictly for UI rendering in components
 * that expect local Date instances.
 */
const toLocalMidnightDate = (iso: string): Date => new Date(iso + 'T00:00:00');

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

export default function CalendarClient({
  events,
  locations = [],
  weatherByLocation = {},
}: {
  events: CalendarEvent[];
  locations?: Array<CalendarLocation>;
  weatherByLocation?: Record<string, WeatherSnapshot>;
}) {
  // Today in UTC ISO (kept fresh by periodic checks that detect UTC day rollover)
  const [todayISO, setTodayISO] = React.useState<string>(() => {
    const nowInit = new Date();
    return isoFromYMD(nowInit.getUTCFullYear(), nowInit.getUTCMonth() + 1, nowInit.getUTCDate());
  });
  const [current, setCurrent] = React.useState<{ y: number; m: number }>(() => {
    const { y, m1 } = parseISO(todayISO);
    return { y, m: m1 - 1 };
  });
  const [filter, setFilter] = React.useState<CalendarFilter>('all');
  const [detail, setDetail] = React.useState<{ open: boolean; date: string | null }>({
    open: false,
    date: null,
  });
  const [range, setRange] = React.useState<'month' | 'week' | 'today'>('month');
  const detailDate = detail.date;
  const primaryLocation = React.useMemo(() => {
    return locations.find((l) => l.latitude != null && l.longitude != null) ?? null;
  }, [locations]);

  React.useEffect(() => {
    try {
      window.localStorage.setItem('calendar.filter', filter);
    } catch (e) {
      console.warn('Failed to persist calendar.filter to localStorage', e);
    }
  }, [filter]);
  React.useEffect(() => {
    try {
      window.localStorage.setItem('calendar.range', range);
    } catch (e) {
      console.warn('Failed to persist calendar.range to localStorage', e);
    }
  }, [range]);
  React.useEffect(() => {
    // Load persisted settings on client after mount to avoid SSR hydration mismatch
    try {
      const storedFilter = window.localStorage.getItem('calendar.filter');
      if (isCalendarFilter(storedFilter)) setFilter(storedFilter);
      const storedRange = window.localStorage.getItem('calendar.range');
      if (isCalendarRange(storedRange)) setRange(storedRange);
    } catch (e) {
      console.warn('Failed to load persisted calendar settings from localStorage', e);
    }
  }, []);

  // Keep todayISO fresh using a single interval (no recursive timers)
  // Checks every 1 minute and updates when the UTC date rolls over.
  React.useEffect(() => {
    const update = () => {
      const now = new Date();
      const iso = isoFromYMD(now.getUTCFullYear(), now.getUTCMonth() + 1, now.getUTCDate());
      setTodayISO((prev) => (prev === iso ? prev : iso));
    };
    update();
    const id = setInterval(update, 60_000); // 1 minute
    return () => clearInterval(id);
  }, []);

  // Focused date for week/day navigation
  const [focusDateISO, setFocusDateISO] = React.useState<string>(() => todayISO);
  const prevRangeRef = React.useRef<'month' | 'week' | 'today'>(range);

  // Keep focus/current in sync in 'today' view.
  // Runs on: (1) switching the range to 'today' and (2) UTC day rollover
  // (todayISO update). If the detail dialog is already open, we keep it open
  // and update the date. If switching into 'today', we open the dialog. We do
  // not auto-reopen the dialog on day rollover if the user closed it while
  // staying in 'today'.
  React.useEffect(() => {
    if (range === 'today') {
      const { y, m1 } = parseISO(todayISO);
      setFocusDateISO(todayISO);
      setCurrent({ y, m: m1 - 1 });
      const cameFromNonToday = prevRangeRef.current !== 'today';
      setDetail((d) =>
        d.open || cameFromNonToday
          ? { open: true, date: todayISO }
          : { open: false, date: todayISO }
      );
    }
    prevRangeRef.current = range;
  }, [todayISO, range]);

  // Memoized allowed-day set for quick membership checks during filtering.
  // Derived from the user's focused date and range selection. We return null
  // for 'month' since all days are in-range and set membership is skipped.
  const allowedDateISOSet = React.useMemo<Set<string> | null>(() => {
    if (range === 'month') return null;
    if (range === 'today') return new Set<string>([focusDateISO]);
    // week
    const s = new Set<string>();
    const startISO = weekStartISO(focusDateISO);
    for (let i = 0; i < 7; i += 1) {
      s.add(addDaysISO(startISO, i));
    }
    return s;
  }, [range, focusDateISO]);

  // Navigation helpers (used by buttons and swipe)
  const navigatePrev = React.useCallback(() => {
    if (range === 'today') {
      const nextISO = addDaysISO(focusDateISO, -1);
      const { y, m1 } = parseISO(nextISO);
      setFocusDateISO(nextISO);
      setCurrent({ y, m: m1 - 1 });
    } else if (range === 'week') {
      const nextISO = addDaysISO(focusDateISO, -7);
      const { y, m1 } = parseISO(nextISO);
      setFocusDateISO(nextISO);
      setCurrent({ y, m: m1 - 1 });
    } else {
      setCurrent(({ y, m }) => (m === 0 ? { y: y - 1, m: 11 } : { y, m: m - 1 }));
    }
  }, [range, focusDateISO]);

  const navigateNext = React.useCallback(() => {
    if (range === 'today') {
      const nextISO = addDaysISO(focusDateISO, 1);
      const { y, m1 } = parseISO(nextISO);
      setFocusDateISO(nextISO);
      setCurrent({ y, m: m1 - 1 });
    } else if (range === 'week') {
      const nextISO = addDaysISO(focusDateISO, 7);
      const { y, m1 } = parseISO(nextISO);
      setFocusDateISO(nextISO);
      setCurrent({ y, m: m1 - 1 });
    } else {
      setCurrent(({ y, m }) => (m === 11 ? { y: y + 1, m: 0 } : { y, m: m + 1 }));
    }
  }, [range, focusDateISO]);

  // Keep header (month/year) in sync with focused date for today/week
  React.useEffect(() => {
    if (range !== 'month') {
      const { y, m1 } = parseISO(focusDateISO);
      setCurrent({ y, m: m1 - 1 });
    }
  }, [range, focusDateISO]);

  const handleTodayClick = React.useCallback(() => {
    const { y, m1 } = parseISO(todayISO);
    setCurrent({ y, m: m1 - 1 });
    setFocusDateISO(todayISO);
  }, [todayISO]);

  // Build cells from ISO math; render using local-midnight Dates for UI components
  const cells: Array<{ iso: string; dateLocal: Date }> = React.useMemo(() => {
    if (range === 'today') {
      const iso = focusDateISO;
      return [{ iso, dateLocal: toLocalMidnightDate(iso) }];
    }
    if (range === 'week') {
      const startISO = weekStartISO(focusDateISO);
      return Array.from({ length: 7 }, (_, i) => {
        const iso = addDaysISO(startISO, i);
        return { iso, dateLocal: toLocalMidnightDate(iso) };
      });
    }
    // month grid (6 weeks)
    const startISO = monthGridStartISO(current.y, current.m);
    return Array.from({ length: 42 }, (_, i) => {
      const iso = addDaysISO(startISO, i);
      return { iso, dateLocal: toLocalMidnightDate(iso) };
    });
  }, [range, focusDateISO, current.y, current.m]);

  // Header label derived in UTC to avoid DST issues
  const headerLabel = React.useMemo(() => {
    const d = new Date(Date.UTC(current.y, current.m, 1));
    return d.toLocaleString(undefined, { month: 'long', year: 'numeric', timeZone: 'UTC' });
  }, [current.y, current.m]);

  const filtered = React.useMemo(() => {
    return events.filter((e) => {
      if (filter !== 'all' && e.type !== filter) return false;
      if (range === 'month') return true;
      const dateOnly = dateOnlyFromISO(e.start);
      return allowedDateISOSet === null || allowedDateISOSet.has(dateOnly);
    });
  }, [events, filter, range, allowedDateISOSet]);

  const byDay = React.useMemo(() => {
    const m = new Map<string, CalendarEvent[]>();
    for (const e of filtered) {
      const day = dateOnlyFromISO(e.start);
      const arr = m.get(day) ?? [];
      arr.push(e);
      if (!m.has(day)) m.set(day, arr);
    }
    return m;
  }, [filtered]);

  return (
    <div className="space-y-3">
      {/* Mobile Layout */}
      <div className="flex flex-col md:hidden gap-2">
        <div className="flex items-center justify-between gap-1">
          {/* Left navigation buttons */}
          <div className="flex items-center gap-1 flex-shrink-0">
            <Button
              variant="outline"
              size="sm"
              className="px-2"
              onClick={() => setCurrent(({ y, m }) => ({ y: y - 1, m }))}
              aria-label="Previous year"
            >
              <ChevronsLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="px-2"
              onClick={navigatePrev}
              aria-label="Previous"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </div>
          {/* Month/Year label - centered and flexible */}
          <div className="font-semibold text-base sm:text-lg text-center flex-1 min-w-0 px-2">
            {headerLabel}
          </div>
          {/* Right navigation buttons */}
          <div className="flex items-center gap-1 flex-shrink-0">
            <Button
              variant="outline"
              size="sm"
              className="px-2"
              onClick={navigateNext}
              aria-label="Next"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="px-2"
              onClick={() => setCurrent(({ y, m }) => ({ y: y + 1, m }))}
              aria-label="Next year"
            >
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
        {/* Mobile weather display */}
        <div className="w-full">
          <CalendarHeaderWeather
            weather={primaryLocation ? weatherByLocation[primaryLocation.id] : null}
          />
        </div>
        {/* Mobile compact filter menu */}
        <div className="w-full sticky top-0 z-10 bg-background/95 supports-[backdrop-filter]:bg-background/60 backdrop-blur rounded-md px-1 py-1 flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="border rounded px-2 py-1 text-xs hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring/40">
                Filters
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-[16rem]">
              <div className="px-3 py-2 text-[11px] uppercase tracking-wide text-muted-foreground/80 border-b">
                Type
              </div>
              {(['all', 'activity', 'planting', 'harvest'] as const).map((v) => {
                const label =
                  v === 'all'
                    ? 'All'
                    : v === 'activity'
                      ? 'Activities'
                      : v === 'planting'
                        ? 'Plantings'
                        : 'Harvests';
                const Icon: LucideIcon =
                  v === 'all'
                    ? CalendarDays
                    : v === 'activity'
                      ? Wrench
                      : v === 'planting'
                        ? Sprout
                        : ShoppingBasket;
                return (
                  <DropdownMenuItem
                    key={v}
                    onClick={() => setFilter(v)}
                    className={filter === v ? 'bg-accent/60 focus:bg-accent/60' : ''}
                  >
                    <span className="inline-flex items-center gap-2">
                      <Icon className="h-4 w-4" />
                      <span>{label}</span>
                    </span>
                  </DropdownMenuItem>
                );
              })}
              <div className="px-3 py-2 text-[11px] uppercase tracking-wide text-muted-foreground/80 border-y">
                Range
              </div>
              {(['month', 'week', 'today'] as const).map((v) => {
                const label = v[0].toUpperCase() + v.slice(1);
                const Icon: LucideIcon =
                  v === 'month' ? Calendar : v === 'week' ? CalendarRange : CalendarDays;
                return (
                  <DropdownMenuItem
                    key={v}
                    onClick={() => setRange(v)}
                    className={range === v ? 'bg-accent/60 focus:bg-accent/60' : ''}
                  >
                    <span className="inline-flex items-center gap-2">
                      <Icon className="h-4 w-4" />
                      <span>{label}</span>
                    </span>
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="secondary" size="sm" className="ml-auto" onClick={handleTodayClick}>
            <CalendarDays className="mr-1 h-4 w-4" /> Today
          </Button>
        </div>
      </div>
      {/* Desktop Layout */}
      <div className="hidden md:block">
        {/* Row 1: Navigation and View Controls */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          {/* Left Group: Month/year navigation */}
          <div className="flex items-center gap-1 flex-shrink-0">
            <Button
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={() => setCurrent(({ y, m }) => ({ y: y - 1, m }))}
              aria-label="Previous year"
            >
              <ChevronsLeft className="h-3 w-3" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={navigatePrev}
              aria-label="Previous"
            >
              <ChevronLeft className="h-3 w-3" />
            </Button>
            <div className="font-semibold text-sm whitespace-nowrap px-1 min-w-[120px] text-center">
              {headerLabel}
            </div>
            <Button
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={navigateNext}
              aria-label="Next"
            >
              <ChevronRight className="h-3 w-3" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={() => setCurrent(({ y, m }) => ({ y: y + 1, m }))}
              aria-label="Next year"
            >
              <ChevronsRight className="h-3 w-3" />
            </Button>
          </div>
          {/* Middle Group: Primary view controls */}
          <div className="flex items-center gap-1 flex-shrink-0">
            <Button variant="secondary" size="sm" className="text-xs" onClick={handleTodayClick}>
              <CalendarDays className="h-3 w-3 mr-1" /> Today
            </Button>
            <div className="flex items-center gap-0.5" role="tablist" aria-label="Range">
              {(['month', 'week', 'today'] as const).map((v) => (
                <button
                  key={v}
                  role="tab"
                  aria-selected={range === v}
                  className={`rounded px-1.5 py-1 text-xs whitespace-nowrap border transition-colors active:scale-95 ${range === v ? 'bg-accent text-accent-foreground' : 'bg-background hover:bg-accent/40'} focus-visible:ring-2 focus-visible:ring-ring/40`}
                  onClick={() => setRange(v)}
                >
                  {v[0].toUpperCase() + v.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>
        {/* Row 2: Filters, Weather, and Legend */}
        <div className="flex items-center justify-between gap-2 mt-2 flex-wrap">
          {/* Filter toggles */}
          <div className="flex items-center gap-0.5 flex-wrap" role="tablist" aria-label="Filter">
            {(['all', 'activity', 'planting', 'harvest'] as const).map((v) => {
              const fullLabel =
                v === 'all'
                  ? 'All'
                  : v === 'activity'
                    ? 'Activities'
                    : v === 'planting'
                      ? 'Plantings'
                      : 'Harvests';
              return (
                <button
                  key={v}
                  role="tab"
                  aria-selected={filter === v}
                  className={`rounded px-1.5 py-1 text-xs whitespace-nowrap border transition-colors active:scale-95 ${filter === v ? 'bg-accent text-accent-foreground' : 'bg-background hover:bg-accent/40'} focus-visible:ring-2 focus-visible:ring-ring/40`}
                  onClick={() => setFilter(v)}
                >
                  {fullLabel}
                </button>
              );
            })}
          </div>
          {/* Right Group: Weather and Legend */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <CalendarHeaderWeather
              weather={primaryLocation ? weatherByLocation[primaryLocation.id] : null}
            />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="border rounded px-1.5 py-1 text-xs hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring/40 whitespace-nowrap">
                  Legend
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64 p-2">
                <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs text-foreground">
                  <div className="inline-flex items-center gap-2">
                    <Droplet className="size-3 text-blue-600" /> Irrigation
                  </div>
                  <div className="inline-flex items-center gap-2">
                    <FlaskConical className="size-3 text-amber-700" /> Soil amendment
                  </div>
                  <div className="inline-flex items-center gap-2">
                    <Bug className="size-3 text-rose-700" /> Pest mgmt.
                  </div>
                  <div className="inline-flex items-center gap-2">
                    <Wrench className="size-3 text-violet-700" /> Maintenance
                  </div>
                  <div className="inline-flex items-center gap-2">
                    <span className="inline-block size-2 rounded-full bg-yellow-500" /> Nursery
                  </div>
                  <div className="inline-flex items-center gap-2">
                    <span className="inline-block size-2 rounded-full bg-green-600" /> Planted
                  </div>
                  <div className="inline-flex items-center gap-2">
                    <span className="inline-block size-2 rounded-full bg-emerald-600" /> Harvested
                  </div>
                  <div className="inline-flex items-center gap-2">
                    <span className="inline-block size-2 rounded-full bg-slate-500" /> Removed
                  </div>
                  <div className="inline-flex items-center gap-2">
                    <ShoppingBasket className="size-3 text-emerald-700" /> Harvest
                  </div>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
      {/* Calendar Grid */}
      <div
        className={`${range === 'week' ? 'md:overflow-x-auto md:-mx-1 md:py-1' : 'overflow-x-auto -mx-1'} pb-2`}
      >
        <div
          className={`px-1 md:px-1 grid ${
            range === 'week'
              ? 'grid-cols-1 md:grid-cols-7'
              : range === 'today'
                ? 'grid-cols-1'
                : 'grid-cols-7'
          } ${range === 'week' ? 'gap-2 md:gap-3' : 'gap-2'} ${range === 'week' ? '' : 'min-w-fit'}`}
        >
          {(() => {
            if (range === 'today') {
              const d = toLocalMidnightDate(focusDateISO);
              return (
                <div className="text-xs text-muted-foreground px-1">{DAY_NAMES[d.getDay()]}</div>
              );
            }
            if (range === 'week') {
              // For week view: show day name headers on desktop, but hide on mobile (day names shown in cells)
              return DAY_NAMES.map((d) => (
                <div key={d} className="hidden md:block text-xs text-muted-foreground px-1">
                  {d}
                </div>
              ));
            }
            return DAY_NAMES.map((d) => (
              <div key={d} className="text-xs text-muted-foreground px-1">
                {d}
              </div>
            ));
          })()}
          {cells.map(({ iso, dateLocal }) => {
            const key = iso;
            const dayEventsRaw = byDay.get(iso) || [];
            const eventsWithPriority = dayEventsRaw.map((e) => ({
              e,
              p: e.type === 'harvest' ? 0 : e.type === 'planting' ? 1 : 2,
            }));
            eventsWithPriority.sort((a, b) => {
              if (a.p !== b.p) return a.p - b.p;
              return (a.e.title || '').localeCompare(b.e.title || '');
            });
            const dayEvents = eventsWithPriority.map(({ e }) => e);
            const dayName = range === 'week' ? DAY_NAMES[dateLocal.getDay()] : null;
            return (
              <DayCell
                key={key}
                date={dateLocal}
                currentMonth={current.m}
                today={toLocalMidnightDate(todayISO)}
                onOpenDetail={(dateISO) => setDetail({ open: true, date: dateISO })}
                events={dayEvents}
                dayName={dayName}
                isWeekView={range === 'week'}
              />
            );
          })}
        </div>
      </div>
      <Dialog
        open={detail.open}
        onOpenChange={(open) => setDetail((d) => ({ open, date: open ? d.date : null }))}
      >
        {detailDate ? (
          <DayDetailDialog
            dateISO={detailDate}
            events={byDay.get(detailDate) || []}
            locations={locations.filter((l) => l.latitude != null && l.longitude != null)}
            onPrev={() => {
              const prevISO = addDaysISO(detailDate, -1);
              setDetail({ open: true, date: prevISO });
            }}
            onNext={() => {
              const nextISO = addDaysISO(detailDate, 1);
              setDetail({ open: true, date: nextISO });
            }}
          />
        ) : null}
      </Dialog>
    </div>
  );
}
