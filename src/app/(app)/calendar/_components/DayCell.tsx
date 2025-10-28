'use client'

import * as React from 'react'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import type { CalendarEvent } from '../types'
import { hawaiianMoonForDate, moonEmojiForDate } from '@/lib/hawaiian-moon'
import { EventChip } from './EventChip'

export function DayCell({
  date,
  currentMonth,
  today,
  onOpenDetail,
  events,
}: {
  date: Date
  currentMonth: number
  today: Date
  onOpenDetail: (dateISO: string) => void
  events: CalendarEvent[]
}) {
  function fmt(d: Date) {
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`
  }
  function isSameDay(a: Date, b: Date) {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
  }
  const key = fmt(date)
  const isOtherMonth = date.getMonth() !== currentMonth
  const isToday = isSameDay(date, today)
  const isWeekend = date.getDay() === 0 || date.getDay() === 6
  const moon = hawaiianMoonForDate(date)
  const dayEvents = [...events]
  return (
    <div
      key={key}
      className={`min-h-28 rounded-lg p-1 border border-border/30 transition-colors transition-shadow hover:border-border/70 hover:shadow-md active:shadow-lg active:bg-accent/10 focus-within:ring-2 focus-within:ring-ring/40 ${isOtherMonth ? 'bg-muted/30 text-muted-foreground' : 'bg-background'} ${isWeekend && !isOtherMonth ? 'bg-muted/20' : ''} ${isToday ? 'ring-2 ring-primary/50' : ''}`}
      onClick={() => onOpenDetail(key)}
      role="button"
      tabIndex={0}
      aria-label={date.toLocaleDateString()}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onOpenDetail(key) }}
    >
      <div className="flex items-center justify-between text-xs mb-2">
        <div className={`font-semibold flex items-center gap-2 ${isToday ? 'text-primary' : ''}`}>
          {date.getDate()}
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                <span aria-hidden="true">{moonEmojiForDate(date)}</span>
                <span className="hidden sm:inline">{moon?.name ?? ''}</span>
              </span>
            </TooltipTrigger>
            <TooltipContent side="top">{moon?.recommendation ?? ''}</TooltipContent>
          </Tooltip>
        </div>
      </div>
      <ul className="space-y-1 mt-1">
        {dayEvents.slice(0, 2).map((e) => (
          <li key={e.id} className="truncate">
            <EventChip e={e} />
          </li>
        ))}
        {dayEvents.length > 2 ? (
          <li className="text-xs text-muted-foreground hidden sm:block">+{dayEvents.length - 2} more</li>
        ) : null}
      </ul>
    </div>
  )
}


