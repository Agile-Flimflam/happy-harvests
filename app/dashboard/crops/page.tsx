// Remove 'use client' directive
// Remove CropsClient component definition and its specific imports

// --- Server Component Page ---
// Add import for the client component
import { CropsClient } from './crops-client';
import { getCropsWithDetails } from '@/app/actions/crops';
import { getCropVarieties } from '@/app/actions/crop-varieties';
import { getBeds } from '@/app/actions/beds';

export default async function CropsPage() {
  // Fetch all necessary data in parallel
  const [
      cropsResult,
      varietiesResult,
      bedsResult
    ] = await Promise.all([
      getCropsWithDetails(),
      getCropVarieties(),
      getBeds()
  ]);

  // Extract data and errors safely
  const crops = cropsResult.crops;
  const cropsError = cropsResult.error;
  const cropVarieties = varietiesResult.cropVarieties; // Will be undefined if varietiesResult has error
  const varietiesError = varietiesResult.error;
  const beds = bedsResult.beds;
  const bedsError = bedsResult.error;

  // Centralized error check
  if (cropsError || varietiesError || bedsError) {
    console.error("Error loading data for crops page:", { cropsError, varietiesError, bedsError });
    const errorMessage = [cropsError, varietiesError, bedsError].filter(Boolean).join('; ');
    // Consider showing a more user-friendly error component
    return <div className="text-red-500">Error loading page data: {errorMessage || 'Unknown error'}</div>;
  }

  // If no error, data should be present, but provide defaults just in case
  // Pass correct prop name: cropVarieties
  return (
      <CropsClient
          crops={crops || []}
          cropVarieties={cropVarieties || []} // Pass cropVarieties prop
          beds={beds || []}
       />
  );
} 