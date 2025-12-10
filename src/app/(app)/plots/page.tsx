import {
  PlotsBedsPageContent,
  type PlotsBedsPageContentProps,
} from './_components/PlotsBedsPageContent';
import { getPlotsPageData } from './actions';

export default async function PlotsBedsPage({
  searchParams,
}: {
  searchParams?: Promise<{ locationId?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const initialLocationId = resolvedSearchParams?.locationId ?? null;
  const result = await getPlotsPageData();
  if (!result.ok) {
    return <div className="text-red-500">Error loading plots and beds: {result.message}</div>;
  }

  const { plotsWithBeds, locations, weatherByLocation } = result.data;

  return (
    <PlotsBedsPageContent
      plotsWithBeds={plotsWithBeds || []}
      locations={locations as PlotsBedsPageContentProps['locations']}
      weatherByLocation={weatherByLocation}
      initialLocationId={initialLocationId}
      quickCreatePrefs={result.data.quickCreatePrefs}
    />
  );
}
