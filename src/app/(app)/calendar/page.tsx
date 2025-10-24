import CalendarClient, { type CalendarEvent } from './CalendarClient'
import CalendarHeaderWeather from './CalendarHeaderWeather'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
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
          <Link className="border px-3 py-2 rounded transition-colors active:scale-95 hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring/40" href="/activities/new">Schedule Activity</Link>
          <Link className="border px-3 py-2 rounded transition-colors active:scale-95 hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring/40" href="/plantings">Manage Plantings</Link>
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


