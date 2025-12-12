import type { Tables } from '@/lib/supabase-server';
import {
  asActionError,
  asActionSuccess,
  createCorrelationId,
  type ActionResult,
} from '@/lib/action-result';
import { getLocationsWithWeather, type WeatherSnapshot } from '../locations/actions';
import {
  createPlot,
  updatePlot,
  deletePlot,
  createBed,
  updateBed,
  deleteBed,
  getPlotsWithBeds,
  getLocationsList,
  getBeds,
  type PlotFormState,
  type BedFormState,
  bulkCreateBeds,
  bulkCreatePlots,
  type BulkBedFormState,
  type BulkPlotFormState,
} from './_actions';
import { getQuickCreatePrefs, type QuickCreatePrefs } from '@/lib/quick-create-prefs';

export type PlotDTO = Tables<'plots'>;
export type BedDTO = Tables<'beds'>;
export type LocationDTO = Tables<'locations'>;
export type PlotWithBedsDTO = PlotDTO & {
  beds: BedDTO[];
  locations: LocationDTO | null;
  totalAcreage: number;
};

export type PlotsPageData = {
  plotsWithBeds: PlotWithBedsDTO[];
  locations: LocationDTO[];
  weatherByLocation: Record<string, WeatherSnapshot>;
  quickCreatePrefs: QuickCreatePrefs | null;
};

export async function getPlotsPageData(): Promise<ActionResult<PlotsPageData>> {
  const correlationId = createCorrelationId();
  const [plotsRes, locationsWeatherRes, prefs] = await Promise.all([
    getPlotsWithBeds(),
    getLocationsWithWeather(),
    getQuickCreatePrefs(),
  ]);

  if (plotsRes.error) {
    return asActionError({ code: 'server', message: plotsRes.error, correlationId });
  }
  if (!locationsWeatherRes.ok) {
    return locationsWeatherRes;
  }
  const locationsFromWeather = locationsWeatherRes.data.locations ?? [];

  return asActionSuccess(
    {
      plotsWithBeds: plotsRes.plots ?? [],
      locations: locationsFromWeather,
      weatherByLocation: locationsWeatherRes.data.weatherByLocation,
      quickCreatePrefs: prefs,
    },
    undefined,
    correlationId
  );
}

export {
  createPlot,
  updatePlot,
  deletePlot,
  createBed,
  updateBed,
  deleteBed,
  getPlotsWithBeds,
  getLocationsList,
  getBeds,
  type PlotFormState,
  type BedFormState,
  bulkCreateBeds,
  bulkCreatePlots,
  type BulkBedFormState,
  type BulkPlotFormState,
};
