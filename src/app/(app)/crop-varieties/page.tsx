import { CropVarietiesPageContent } from './_components/CropVarietiesPageContent';
import { getCropVarieties } from './_actions';
import { createSupabaseServerClient, type Tables } from '@/lib/supabase-server';

export default async function PlantsPage() {
  const { cropVarieties, error } = await getCropVarieties();
  const supabase = await createSupabaseServerClient();
  const { data: crops } = await supabase
    .from('crops')
    .select('id, name, crop_type, created_at')
    .returns<Array<Pick<Tables<'crops'>, 'id' | 'name' | 'crop_type' | 'created_at'>>>()
    .order('name', { ascending: true });

  if (error) {
    return <div className="text-red-500">Error loading crop varieties: {error}</div>;
  }

  const typedCrops =
    crops ?? ([] as Array<Pick<Tables<'crops'>, 'id' | 'name' | 'crop_type' | 'created_at'>>);

  return <CropVarietiesPageContent cropVarieties={cropVarieties} crops={typedCrops} />;
}
