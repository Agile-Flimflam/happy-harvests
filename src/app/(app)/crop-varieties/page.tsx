import { CropVarietiesPageContent } from './_components/CropVarietiesPageContent';
import { getCropVarietyContext } from './_actions';

export default async function PlantsPage() {
  const { cropVarieties, crops, prefs, error } = await getCropVarietyContext();

  if (error) {
    return <div className="text-red-500">Error loading crop varieties: {error}</div>;
  }

  return <CropVarietiesPageContent cropVarieties={cropVarieties} crops={crops} prefs={prefs} />;
}
