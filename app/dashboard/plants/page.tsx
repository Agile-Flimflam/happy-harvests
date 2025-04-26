// Remove 'use client' directive
// Remove PlantsClient component definition and its specific imports

// --- Server Component Page ---
// Add import for the client component
import { PlantsClient } from './plants-client';
import { getPlants } from '@/app/actions/plants';

// This remains a Server Component to fetch initial data
export default async function PlantsPage() {
  const { plants, error } = await getPlants();

  if (error) {
    return <div className="text-red-500">Error loading plants: {error}</div>;
  }

  // Pass the fetched data to the client component
  return <PlantsClient plants={plants || []} />;
} 