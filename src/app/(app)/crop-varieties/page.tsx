import { CropVarietiesPageContent } from './_components/CropVarietiesPageContent';
import { getCropVarieties } from './_actions';

export default async function PlantsPage() {
  const { cropVarieties, error } = await getCropVarieties();

  if (error) {
    return <div className="text-red-500">Error loading crop varieties: {error}</div>;
  }

  if (!cropVarieties) {
    return <div>Loading crop varieties...</div>;
  }

  return <CropVarietiesPageContent cropVarieties={cropVarieties} />;
}


