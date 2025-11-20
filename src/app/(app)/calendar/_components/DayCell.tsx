'use client';

import * as React from 'react';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import type { CalendarEvent } from '../types';
import { hawaiianMoonForDate, moonEmojiForDate } from '@/lib/hawaiian-moon';
import { EventChip } from './EventChip';

export function DayCell({
  date,
  currentMonth,
  today,
  onOpenDetail,
  events,
  dayName,
  isWeekView,
}: {
  date: Date;
  currentMonth: number;
  today: Date;
  onOpenDetail: (dateISO: string) => void;
  events: CalendarEvent[];
  dayName?: string | null;
  isWeekView?: boolean;
}) {
  function fmt(d: Date) {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }
  function isSameDay(a: Date, b: Date) {
    return (
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate()
    );
  }
  const key = fmt(date);
  const isOtherMonth = date.getMonth() !== currentMonth;
  const isToday = isSameDay(date, today);
  const isWeekend = date.getDay() === 0 || date.getDay() === 6;
  const moon = hawaiianMoonForDate(date);
  const dayEvents = [...events];
  const showDayName = isWeekView && dayName;

  // Simplified date display
  const dateNumber = date.getDate();
  const monthShort = date.toLocaleDateString(undefined, { month: 'short' });

  return (
    <div
      key={key}
      className={`${isWeekView ? 'md:min-h-28 min-h-32' : 'min-h-28'} rounded-lg border border-border/30 transition-colors transition-shadow hover:border-border/70 hover:shadow-md active:shadow-lg active:bg-accent/10 focus-within:ring-2 focus-within:ring-ring/40 ${isOtherMonth ? 'bg-muted/30 text-muted-foreground' : 'bg-background'} ${isWeekend && !isOtherMonth ? 'bg-muted/20' : ''} ${isToday ? 'ring-2 ring-primary/50' : ''}`}
      onClick={() => onOpenDetail(key)}
      role="button"
      tabIndex={0}
      aria-label={date.toLocaleDateString()}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onOpenDetail(key);
      }}
    >
      {/* Inner content container with overflow control */}
      <div className={`${isWeekView ? 'p-2 md:p-3' : 'p-2'} overflow-hidden h-full`}>
        {/* Header: Day name and date */}
        <div className="mb-2">
          {showDayName ? (
            // Week view: Show day name and date together
            <div className="flex items-baseline gap-2">
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {dayName}
              </div>
              <div className={`text-lg font-semibold ${isToday ? 'text-primary' : ''}`}>
                {dateNumber}
              </div>
              <div className="ml-auto flex items-center gap-2">
                {!isOtherMonth && <div className="text-xs text-muted-foreground">{monthShort}</div>}
                {/* Moon phase - only on desktop for week view */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="hidden md:inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                      <span aria-hidden="true">{moonEmojiForDate(date)}</span>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top">{moon?.recommendation ?? ''}</TooltipContent>
                </Tooltip>
              </div>
            </div>
          ) : (
            // Month view: Just show date number
            <div className="flex items-center justify-between">
              <div className={`text-base font-semibold ${isToday ? 'text-primary' : ''}`}>
                {dateNumber}
              </div>
              {/* Moon phase - only on desktop for month view (consistent with week view) */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="hidden md:inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                    <span aria-hidden="true">{moonEmojiForDate(date)}</span>
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top">{moon?.recommendation ?? ''}</TooltipContent>
              </Tooltip>
            </div>
          )}
        </div>

        {/* Events list */}
        <ul className="space-y-1.5 overflow-hidden">
          {dayEvents.slice(0, isWeekView ? 5 : 2).map((e) => (
            <li key={e.id} className="overflow-hidden">
              <EventChip
                e={e}
                showText={
                  isWeekView
                    ? 'always' // Week view (stacked on mobile): always show full text
                    : 'auto' // Month view: auto (icon on small, text on medium and up)
                }
              />
            </li>
          ))}
          {dayEvents.length > (isWeekView ? 5 : 2) && (
            <li className="text-xs text-muted-foreground pt-0.5">
              +{dayEvents.length - (isWeekView ? 5 : 2)} more
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}
