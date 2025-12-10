import type { Tables } from '@/lib/supabase-server';
import { asActionError, type ActionResult } from '@/lib/action-result';
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
  const [plotsRes, locationsWeatherRes, locationsListRes, prefs] = await Promise.all([
    getPlotsWithBeds(),
    getLocationsWithWeather(),
    getLocationsList(),
    getQuickCreatePrefs(),
  ]);

  if (plotsRes.error) {
    return asActionError({ code: 'server', message: plotsRes.error });
  }
  if (!locationsWeatherRes.ok) {
    return locationsWeatherRes;
  }
  const locationsFromList = locationsListRes.locations ?? [];

  return {
    ok: true,
    data: {
      plotsWithBeds: plotsRes.plots ?? [],
      locations: locationsFromList,
      weatherByLocation: locationsWeatherRes.data.weatherByLocation,
      quickCreatePrefs: prefs,
    },
  };
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
