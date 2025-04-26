// Remove 'use client' directive
// Remove PlotsBedsClient component definition and its specific imports

// --- Server Component Page ---
// Add import for the client component
import { PlotsBedsClient } from './plots-beds-client';
import { getPlotsWithBeds } from '@/app/actions/plots';

export default async function PlotsBedsPage() {
  const { plots: plotsWithBedsData, error } = await getPlotsWithBeds();

  if (error) {
    return <div className="text-red-500">Error loading plots and beds: {error}</div>;
  }

  return <PlotsBedsClient plotsWithBeds={plotsWithBedsData || []} />;
} 