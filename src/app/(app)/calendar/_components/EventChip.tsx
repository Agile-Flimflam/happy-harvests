'use client';

import * as React from 'react';
import { Droplet, Sprout, Wrench, Bug, FlaskConical, ShoppingBasket } from 'lucide-react';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { TooltipProvider } from '@/components/ui/tooltip';
import type { CalendarEvent } from '../types';

function isMetaRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function getMeta(e: CalendarEvent): Record<string, unknown> | undefined {
  return isMetaRecord(e.meta) ? e.meta : undefined;
}

function activityTypeOf(e: CalendarEvent): string | undefined {
  const meta = getMeta(e);
  const t = meta?.activity_type;
  return typeof t === 'string' ? t : undefined;
}

function plantingStatusOf(e: CalendarEvent): string | undefined {
  const meta = getMeta(e);
  const s = meta?.status;
  return typeof s === 'string' ? s : undefined;
}

function eventColorClasses(e: CalendarEvent): string {
  if (e.type === 'activity') {
    switch (activityTypeOf(e)) {
      case 'irrigation':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-100';
      case 'soil_amendment':
        return 'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100';
      case 'pest_management':
        return 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-100';
      case 'asset_maintenance':
        return 'bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-100';
      default:
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-100';
    }
  }
  if (e.type === 'harvest') {
    return 'bg-emerald-200 text-emerald-900 dark:bg-emerald-900/60 dark:text-emerald-100';
  }
  switch (plantingStatusOf(e)) {
    case 'nursery':
      return 'bg-yellow-100 text-yellow-900 dark:bg-yellow-900/40 dark:text-yellow-100';
    case 'planted':
      return 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-100';
    case 'harvested':
      return 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-100';
    case 'removed':
      return 'bg-slate-200 text-slate-900 dark:bg-slate-700/60 dark:text-slate-100';
    default:
      return 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-100';
  }
}

export function EventChip({
  e,
  showText = 'auto',
}: {
  e: CalendarEvent;
  showText?: 'always' | 'never' | 'auto';
}) {
  const cls = eventColorClasses(e);
  function Icon() {
    if (e.type === 'activity') {
      switch (activityTypeOf(e)) {
        case 'irrigation':
          return <Droplet className="size-4 sm:size-3 opacity-80" aria-hidden="true" />;
        case 'soil_amendment':
          return <FlaskConical className="size-4 sm:size-3 opacity-80" aria-hidden="true" />;
        case 'pest_management':
          return <Bug className="size-4 sm:size-3 opacity-80" aria-hidden="true" />;
        case 'asset_maintenance':
          return <Wrench className="size-4 sm:size-3 opacity-80" aria-hidden="true" />;
        default:
          return <Droplet className="size-4 sm:size-3 opacity-80" aria-hidden="true" />;
      }
    }
    if (e.type === 'harvest') {
      return <ShoppingBasket className="size-4 sm:size-3 opacity-80" aria-hidden="true" />;
    }
    return <Sprout className="size-4 sm:size-3 opacity-80" aria-hidden="true" />;
  }
  const meta = getMeta(e);
  const start = typeof meta?.window_start === 'string' ? meta.window_start : undefined;
  const end = typeof meta?.window_end === 'string' ? meta.window_end : undefined;
  const range = start && end ? `${start.slice(5)}–${end.slice(5)}` : undefined;
  const metaCrop = meta && typeof meta.crop === 'string' ? meta.crop : undefined;
  const baseText =
    e.type === 'harvest'
      ? (['Harvest', metaCrop].filter(Boolean) as string[]).join(' · ')
      : e.title;
  const displayText = e.type === 'harvest' ? baseText : range ? `${baseText} · ${range}` : baseText;

  // Determine text visibility based on showText prop
  // 'always': Always show text (for week view on mobile when stacked)
  // 'never': Never show text (icon only)
  // 'auto': Show text on medium screens and up (md+), icon only on small screens (for month view)
  const textClasses =
    showText === 'always'
      ? 'inline truncate max-w-full'
      : showText === 'never'
        ? 'hidden'
        : 'hidden md:inline truncate max-w-[10rem] 2xl:max-w-[14rem]';

  return (
    <TooltipProvider delayDuration={500}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={`inline-flex items-center gap-1 rounded-full px-1 py-0 text-[10px] sm:px-1.5 sm:py-0.5 sm:text-xs ${cls} transition-colors transition-shadow hover:shadow-sm active:shadow-md`}
          >
            <Icon />
            <span className={textClasses}>{displayText}</span>
          </span>
        </TooltipTrigger>
        <TooltipContent side="top">{e.title}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
