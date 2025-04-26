// Remove 'use client' directive
// Remove CropsClient component definition and its specific imports

// --- Server Component Page ---
// Add import for the client component
import { CropsClient } from './crops-client';
import { getCropsWithDetails } from '@/app/actions/crops';
import { getPlants } from '@/app/actions/plants';
import { getBeds } from '@/app/actions/beds';

export default async function CropsPage() {
  // Fetch all necessary data in parallel
  const [
      { crops, error: cropsError },
      { plants, error: plantsError },
      { beds, error: bedsError }
    ] = await Promise.all([
      getCropsWithDetails(),
      getPlants(),
      getBeds() // Fetch beds with plot names for the form dropdown
  ]);

  if (cropsError || plantsError || bedsError) {
    console.error("Error loading data for crops page:", { cropsError, plantsError, bedsError });
    // Render specific error messages or a general error
    const errorMessage = [cropsError, plantsError, bedsError].filter(Boolean).join('; ');
    return <div className="text-red-500">Error loading page data: {errorMessage || 'Unknown error'}</div>;
  }

  return (
      <CropsClient
          crops={crops || []}
          plants={plants || []}
          beds={beds || []}
       />
  );
} 