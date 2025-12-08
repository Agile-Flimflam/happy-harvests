import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Leaf, Sprout, Tractor } from 'lucide-react';
import CalendarHeaderWeather from './calendar/CalendarHeaderWeather';
import { getDashboardOverview } from './actions';

export default async function DashboardPage() {
  const { cropVarietyCount, plotCount, plantingCount, primaryLocation, error } =
    await getDashboardOverview();

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Dashboard</h1>
      {primaryLocation ? (
        <div className="mb-4">
          <CalendarHeaderWeather
            id={primaryLocation.id}
            latitude={primaryLocation.latitude}
            longitude={primaryLocation.longitude}
          />
        </div>
      ) : null}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card className="cursor-pointer transition hover:shadow-md">
          <Link href="/crop-varieties" className="block h-full">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Crop Varieties</CardTitle>
              <Leaf className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{cropVarietyCount ?? 'N/A'}</div>
              {error && <p className="text-xs text-red-500">Error loading</p>}
            </CardContent>
          </Link>
        </Card>
        <Card className="cursor-pointer transition hover:shadow-md">
          <Link href="/plots" className="block h-full">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Plots</CardTitle>
              <Tractor className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{plotCount ?? 'N/A'}</div>
              {error && <p className="text-xs text-red-500">Error loading</p>}
            </CardContent>
          </Link>
        </Card>
        <Card className="cursor-pointer transition hover:shadow-md">
          <Link href="/plantings" className="block h-full">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Plantings</CardTitle>
              <Sprout className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{plantingCount ?? 'N/A'}</div>
              {error && <p className="text-xs text-red-500">Error loading</p>}
            </CardContent>
          </Link>
        </Card>
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
