import { PlotsBedsPageContent } from './_components/PlotsBedsPageContent';
import { getPlotsWithBeds } from './_actions';

export default async function PlotsBedsPage() {
  const { plots: plotsWithBedsData, error } = await getPlotsWithBeds();

  if (error) {
    return <div className="text-red-500">Error loading plots and beds: {error}</div>;
  }

  return <PlotsBedsPageContent plotsWithBeds={plotsWithBedsData || []} />;
}


