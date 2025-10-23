import { createSupabaseServerClient } from '@/lib/supabase-server';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Leaf, Sprout, Tractor } from 'lucide-react';
import CalendarHeaderWeather from './calendar/CalendarHeaderWeather'

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient();

  // Fetch counts in parallel
  const { count: cropVarietyCount, error: cropVarietyError } = await supabase
    .from('crop_varieties')
    .select('*', { count: 'exact', head: true });

  const { count: plotCount, error: plotError } = await supabase
    .from('plots')
    .select('*', { count: 'exact', head: true });

  const { count: cropCount, error: cropError } = await supabase
    .from('crops')
    .select('*', { count: 'exact', head: true });

  // Find a primary location for weather/moon display
  const { data: locations } = await supabase
    .from('locations')
    .select('id, latitude, longitude')
    .order('created_at', { ascending: true })
    .limit(10)
  const primary = (locations || []).find((l) => l.latitude != null && l.longitude != null) as
    | { id: string; latitude: number | null; longitude: number | null }
    | undefined

  if (cropVarietyError || plotError || cropError) {
      console.error('Error fetching counts:', { cropVarietyError, plotError, cropError });
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Dashboard</h1>
      {primary ? (
        <div className="mb-4">
          <CalendarHeaderWeather id={primary.id} latitude={primary.latitude} longitude={primary.longitude} />
        </div>
      ) : null}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Link href="/crop-varieties" className="block">
          <Card className="cursor-pointer transition hover:shadow-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Crop Varieties</CardTitle>
            <Leaf className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{cropVarietyCount ?? 'N/A'}</div>
            {cropVarietyError && <p className="text-xs text-red-500">Error loading</p>}
          </CardContent>
          </Card>
        </Link>
        <Link href="/plots" className="block">
          <Card className="cursor-pointer transition hover:shadow-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Plots</CardTitle>
            <Tractor className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{plotCount ?? 'N/A'}</div>
             {plotError && <p className="text-xs text-red-500">Error loading</p>}
          </CardContent>
          </Card>
        </Link>
        <Link href="/plantings" className="block">
          <Card className="cursor-pointer transition hover:shadow-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Plantings</CardTitle>
            <Sprout className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{cropCount ?? 'N/A'}</div>
             {cropError && <p className="text-xs text-red-500">Error loading</p>}
          </CardContent>
          </Card>
        </Link>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              <Button asChild>
                <Link href="/activities/new">Track an Activity</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/activities">View Activities</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}


