import { LocationsPageContent } from './_components/LocationsPageContent';
import { getLocationsWithWeather } from './actions';

export default async function LocationsPage() {
  const result = await getLocationsWithWeather();
  if (!result.ok) {
    return <div className="text-red-500">Error loading locations: {result.message}</div>;
  }
  return (
    <LocationsPageContent
      locations={result.data.locations}
      weatherByLocation={result.data.weatherByLocation}
      quickCreatePrefs={result.data.quickCreatePrefs}
    />
  );
}
