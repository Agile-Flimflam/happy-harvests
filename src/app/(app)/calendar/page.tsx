import CalendarClient, { type CalendarEvent } from './CalendarClient'
import CalendarHeaderWeather from './CalendarHeaderWeather'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { CalendarPlus, Sprout } from 'lucide-react'
import { getCalendarEvents, getCalendarLocations } from './_actions'

export default async function CalendarPage() {
  const [{ events }, { locations }] = await Promise.all([getCalendarEvents(), getCalendarLocations()])
  const primary = (locations || []).find((l) => l.latitude != null && l.longitude != null) as
    | { id: string; name: string; latitude: number | null; longitude: number | null }
    | undefined
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Calendar</h1>
        <div className="flex gap-2">
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
      <div>
        <CalendarHeaderWeather id={primary?.id ?? null} latitude={primary?.latitude ?? null} longitude={primary?.longitude ?? null} />
      </div>
      <Card>
        <CardContent className="p-0">
          <div className="rounded-xl bg-gradient-to-b from-muted/20 via-muted/10 to-transparent p-3 sm:p-4">
            <CalendarClient events={events as CalendarEvent[]} locations={locations} />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}


