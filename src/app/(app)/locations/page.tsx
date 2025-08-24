import { LocationsPageContent } from './_components/LocationsPageContent';
import { getLocations } from './_actions';

export default async function LocationsPage() {
  const { locations, error } = await getLocations();
  if (error) {
    return <div className="text-red-500">Error loading locations: {error}</div>;
  }
  return <LocationsPageContent locations={locations || []} />;
}
