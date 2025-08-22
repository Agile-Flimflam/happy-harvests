import { PlantingsPageContent } from './_components/PlantingsPageContent';
import { getPlantingsWithDetails, getCropVarietiesForSelect, getBedsForSelect } from './_actions';

export default async function PlantingsPage() {
  const [plantingsResult, varietiesResult, bedsResult] = await Promise.all([
    getPlantingsWithDetails(),
    getCropVarietiesForSelect(),
    getBedsForSelect(),
  ]);

  const plantings = plantingsResult.plantings;
  const plantingsError = plantingsResult.error;
  const cropVarieties = varietiesResult.varieties;
  const varietiesError = varietiesResult.error;
  const beds = bedsResult.beds;
  const bedsError = bedsResult.error;

  if (plantingsError || varietiesError || bedsError) {
    const errorMessage = [plantingsError, varietiesError, bedsError].filter(Boolean).join('; ');
    return <div className="text-red-500">Error loading page data: {errorMessage || 'Unknown error'}</div>;
  }

  return (
    <PlantingsPageContent
      plantings={plantings || []}
      cropVarieties={cropVarieties || []}
      beds={beds || []}
    />
  );
}


