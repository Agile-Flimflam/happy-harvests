import CalendarClient from './CalendarClient';
import type { CalendarEvent } from './types';
export const revalidate = 0;
export const dynamic = 'force-dynamic';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CalendarPlus, Sprout } from 'lucide-react';
import { getCalendarEvents, getCalendarLocations } from './_actions';
import { getLocationsWithWeather } from '../locations/actions';

export default async function CalendarPage() {
  const [{ events }, { locations }, weatherRes] = await Promise.all([
    getCalendarEvents(),
    getCalendarLocations(),
    getLocationsWithWeather(),
  ]);

  const weatherByLocation = weatherRes.ok ? weatherRes.data.weatherByLocation : {};
  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <h1 className="text-3xl font-bold">Calendar</h1>
        <div className="grid grid-cols-1 sm:flex gap-2 w-full sm:w-auto">
          <Button asChild>
            <Link href="/activities/new" aria-label="Schedule Activity">
              <CalendarPlus className="mr-2 h-4 w-4" /> Schedule Activity
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/plantings" aria-label="Manage Plantings">
              <Sprout className="mr-2 h-4 w-4" /> Manage Plantings
            </Link>
          </Button>
        </div>
      </div>
      <Card>
        <CardContent className="p-0">
          <div className="rounded-xl bg-gradient-to-b from-muted/20 via-muted/10 to-transparent p-3 sm:p-4">
            <CalendarClient
              events={events as CalendarEvent[]}
              locations={locations}
              weatherByLocation={weatherByLocation}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
