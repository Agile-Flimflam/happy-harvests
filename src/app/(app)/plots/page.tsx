import { PlotsBedsPageContent, type PlotsBedsPageContentProps } from './_components/PlotsBedsPageContent';
import { getPlotsWithBeds, getLocationsList } from './_actions';

export default async function PlotsBedsPage() {
  const [{ plots: plotsWithBedsData, error }, { locations = [] }] = await Promise.all([
    getPlotsWithBeds(),
    getLocationsList(),
  ]);

  if (error) {
    return <div className="text-red-500">Error loading plots and beds: {error}</div>;
  }

  return <PlotsBedsPageContent plotsWithBeds={plotsWithBedsData || []} locations={locations as PlotsBedsPageContentProps['locations']} />;
}


