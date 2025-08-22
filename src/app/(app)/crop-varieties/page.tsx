import { CropVarietiesPageContent } from './_components/CropVarietiesPageContent';
import { getCropVarieties } from './_actions';
import { createSupabaseServerClient } from '@/lib/supabase-server';

export default async function PlantsPage() {
  const { cropVarieties, error } = await getCropVarieties();
  const supabase = await createSupabaseServerClient();
  const { data: crops } = await supabase.from('crops').select('id, name').order('name', { ascending: true });

  if (error) {
    return <div className="text-red-500">Error loading crop varieties: {error}</div>;
  }

  if (!cropVarieties) {
    return <div>Loading crop varieties...</div>;
  }

  return <CropVarietiesPageContent cropVarieties={cropVarieties} crops={(crops ?? []).map((c) => ({ id: c.id as number, name: c.name as string }))} />;
}


