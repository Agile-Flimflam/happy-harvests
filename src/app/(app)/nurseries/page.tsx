import { getNurseries, getLocationsForSelect, getNurseryStats } from './_actions';
import NurseriesPageContent from './_components/NurseriesPageContent';
import { getCropVarietiesForSelect } from '../plantings/_actions';
import { createSupabaseServerClient, type Tables } from '@/lib/supabase-server';

export default async function NurseriesPage() {
  const supabase = await createSupabaseServerClient();
  const [
    { nurseries, error: nErr },
    { locations, error: lErr },
    { varieties, error: vErr },
    { stats, error: sErr },
    { data: crops, error: cropsErr },
  ] = await Promise.all([
    getNurseries(),
    getLocationsForSelect(),
    getCropVarietiesForSelect(),
    getNurseryStats(),
    supabase
      .from('crops')
      .select('id, name, crop_type, created_at')
      .order('name', { ascending: true })
      .returns<Array<Pick<Tables<'crops'>, 'id' | 'name' | 'crop_type' | 'created_at'>>>(),
  ]);

  const error = nErr || lErr || vErr || sErr || cropsErr?.message;
  return (
    <NurseriesPageContent
      nurseries={nurseries || []}
      locations={locations || []}
      cropVarieties={varieties || []}
      crops={crops || []}
      stats={stats}
      error={error}
    />
  );
}
