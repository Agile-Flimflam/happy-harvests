// Remove 'use client' directive
// Remove PlantsClient component definition and its specific imports

// --- Server Component Page ---
// Add import for the client component
import { CropVarietiesClient } from './crop-varieties-client';
import { getCropVarieties } from '@/app/actions/crop-varieties';

// This remains a Server Component to fetch initial data
export default async function PlantsPage() {
  const { cropVarieties, error } = await getCropVarieties();

  if (error) {
    return <div className="text-red-500">Error loading crop varieties: {error}</div>;
  }

  if (!cropVarieties) {
    return <div>Loading crop varieties...</div>;
  }

  // Pass the fetched data to the client component
  return <CropVarietiesClient cropVarieties={cropVarieties} />;
} 