import { LocationsPageContent } from './_components/LocationsPageContent';
import { getLocations } from './_actions';

export default async function LocationsPage() {
  const { locations, error } = await getLocations();
  if (error) {
    const message = typeof error === 'string' ? error : 'Unknown error';
    return <div className="text-red-500">Error loading locations: {message}</div>;
  }
  return <LocationsPageContent locations={locations ?? []} />;
}
