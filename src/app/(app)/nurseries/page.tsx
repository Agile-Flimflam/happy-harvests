import { getNurseries, getLocationsForSelect } from './_actions';
import NurseriesPageContent from './_components/NurseriesPageContent';

export default async function NurseriesPage() {
  const [{ nurseries, error: nErr }, { locations, error: lErr }] = await Promise.all([
    getNurseries(),
    getLocationsForSelect(),
  ]);
  const error = nErr || lErr;
  return <NurseriesPageContent nurseries={nurseries || []} locations={locations || []} error={error} />;
}

