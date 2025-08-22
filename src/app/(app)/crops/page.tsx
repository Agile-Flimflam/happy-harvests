import { CropsPageContent } from './_components/CropsPageContent';
import { getCropsWithDetails } from './_actions';
import { getCropVarieties } from '../crop-varieties/_actions';
import { getBeds } from '../plots/_actions';

export default async function CropsPage() {
  const [cropsResult, varietiesResult, bedsResult] = await Promise.all([
    getCropsWithDetails(),
    getCropVarieties(),
    getBeds(),
  ]);

  const crops = cropsResult.crops;
  const cropsError = cropsResult.error;
  const cropVarieties = varietiesResult.cropVarieties;
  const varietiesError = varietiesResult.error;
  const beds = bedsResult.beds;
  const bedsError = bedsResult.error;

  if (cropsError || varietiesError || bedsError) {
    console.error("Error loading data for crops page:", { cropsError, varietiesError, bedsError });
    const errorMessage = [cropsError, varietiesError, bedsError].filter(Boolean).join('; ');
    return <div className="text-red-500">Error loading page data: {errorMessage || 'Unknown error'}</div>;
  }

  return (
    <CropsPageContent
      crops={crops || []}
      cropVarieties={cropVarieties || []}
      beds={beds || []}
    />
  );
}


