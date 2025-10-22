import { PlantingsPageContent } from './_components/PlantingsPageContent';
import { getPlantingsWithDetails, getCropVarietiesForSelect, getBedsForSelect, getNurseriesForSelect } from './_actions';

export default async function PlantingsPage({ searchParams }: { searchParams?: { schedule?: string; mode?: 'nursery' | 'direct' } }) {
  const [plantingsResult, varietiesResult, bedsResult, nurseriesResult] = await Promise.all([
    getPlantingsWithDetails(),
    getCropVarietiesForSelect(),
    getBedsForSelect(),
    getNurseriesForSelect(),
  ]);

  const plantings = plantingsResult.plantings;
  const plantingsError = plantingsResult.error;
  const cropVarieties = varietiesResult.varieties;
  const varietiesError = varietiesResult.error;
  const beds = bedsResult.beds;
  const bedsError = bedsResult.error;
  const nurseries = nurseriesResult.nurseries;
  const nurseriesError = nurseriesResult.error;

  if (plantingsError || varietiesError || bedsError || nurseriesError) {
    const errorMessage = [plantingsError, varietiesError, bedsError, nurseriesError].filter(Boolean).join('; ');
    return <div className="text-red-500">Error loading page data: {errorMessage || 'Unknown error'}</div>;
  }

  return (
    <PlantingsPageContent
      plantings={plantings || []}
      cropVarieties={cropVarieties || []}
      beds={beds || []}
      nurseries={nurseries || []}
      scheduleDate={searchParams?.schedule}
      defaultCreateMode={searchParams?.mode}
    />
  );
}


