import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import { Leaf, Sprout, Tractor } from 'lucide-react';
import CalendarHeaderWeather from './calendar/CalendarHeaderWeather';
import { getDashboardOverview, getQuickActionContext } from './actions';
import { sanitizeErrorMessage } from '@/lib/sanitize';
import { QuickActionsHub } from '@/components/ui/quick-actions-hub';
import { fetchWeatherByCoords } from '@/lib/openweather';
import type { WeatherSnapshot } from './locations/actions';

export default async function DashboardPage() {
  const [overviewResult, quickActionsResult] = await Promise.all([
    getDashboardOverview(),
    getQuickActionContext(),
  ]);

  if (!overviewResult.ok) {
    const safeMessage = sanitizeErrorMessage(overviewResult.message);
    return (
      <div>
        <h1 className="text-3xl font-bold mb-6">Dashboard</h1>
        <p className="text-sm text-red-500">{safeMessage}</p>
      </div>
    );
  }

  const overview = overviewResult.data;
  const {
    cropVarietyCount,
    plotCount,
    plantingCount,
    primaryLocation,
    cropVarietyError,
    plotError,
    plantingError,
  } = overview;
  let primaryWeather: WeatherSnapshot | null = null;
  if (primaryLocation?.latitude != null && primaryLocation.longitude != null) {
    try {
      primaryWeather = await fetchWeatherByCoords(
        primaryLocation.latitude,
        primaryLocation.longitude,
        {
          units: 'imperial',
        }
      );
    } catch (error) {
      console.error('[Dashboard] Failed to fetch weather for primary location', { error });
      primaryWeather = null;
    }
  }
  const safeCropVarietyError = cropVarietyError ? sanitizeErrorMessage(cropVarietyError) : null;
  const safePlotError = plotError ? sanitizeErrorMessage(plotError) : null;
  const safePlantingError = plantingError ? sanitizeErrorMessage(plantingError) : null;
  const quickContext = quickActionsResult.ok ? quickActionsResult.data : null;

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Dashboard</h1>
      {primaryLocation ? (
        <div className="mb-4">
          <CalendarHeaderWeather weather={primaryWeather} />
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
              {safeCropVarietyError && (
                <p className="text-xs text-red-500">{safeCropVarietyError}</p>
              )}
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
              {safePlotError && <p className="text-xs text-red-500">{safePlotError}</p>}
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
              {safePlantingError && <p className="text-xs text-red-500">{safePlantingError}</p>}
            </CardContent>
          </Link>
        </Card>
        {quickContext ? (
          <div className="lg:col-span-2 xl:col-span-3">
            <QuickActionsHub context={quickContext} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
