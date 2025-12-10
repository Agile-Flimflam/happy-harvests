import { PlantingsPageContent } from './_components/PlantingsPageContent';
import {
  getPlantingsWithDetails,
  getCropVarietiesForSelect,
  getBedsForSelect,
  getNurseriesForSelect,
} from './_actions';
import { getQuickActionContext } from '../actions';
import type { Tables } from '@/lib/supabase-server';
import type { PlantingWithDetails } from '@/lib/types';

type CropVariety = Pick<
  Tables<'crop_varieties'>,
  | 'id'
  | 'name'
  | 'latin_name'
  | 'dtm_direct_seed_min'
  | 'dtm_direct_seed_max'
  | 'dtm_transplant_min'
  | 'dtm_transplant_max'
> & { crops?: { name: string } | null };
type Bed = Pick<Tables<'beds'>, 'id' | 'length_inches' | 'width_inches'> & {
  plots?: { locations: { name: string } | null } | null;
};
type Nursery = { id: string; name: string };

type PlantingsSearchParams = {
  schedule?: string;
  mode?: 'nursery' | 'direct';
  bedId?: string;
  nurseryId?: string;
};

export default async function PlantingsPage({
  searchParams,
}: {
  searchParams?: Promise<PlantingsSearchParams>;
}) {
  const [plantingsRes, varietiesRes, bedsRes, nurseriesRes, quickContextRes] = await Promise.all([
    getPlantingsWithDetails(),
    getCropVarietiesForSelect(),
    getBedsForSelect(),
    getNurseriesForSelect(),
    getQuickActionContext(),
  ]);

  const plantings = plantingsRes.plantings || [];
  const cropVarieties = varietiesRes.varieties || [];
  const beds = bedsRes.beds || [];
  const nurseries = nurseriesRes.nurseries || [];

  const sp = searchParams ? await searchParams : undefined;
  const scheduleDate = typeof sp?.schedule === 'string' ? sp.schedule : undefined;
  const defaultCreateMode = sp?.mode === 'nursery' || sp?.mode === 'direct' ? sp.mode : null;
  const defaultBedId = sp?.bedId && !Number.isNaN(Number(sp.bedId)) ? Number(sp.bedId) : null;
  const defaultNurseryId = typeof sp?.nurseryId === 'string' ? sp.nurseryId : null;

  return (
    <PlantingsPageContent
      plantings={plantings as PlantingWithDetails[]}
      cropVarieties={cropVarieties as CropVariety[]}
      beds={beds as Bed[]}
      nurseries={nurseries as Nursery[]}
      scheduleDate={scheduleDate}
      defaultCreateMode={
        defaultCreateMode ?? (defaultBedId ? 'direct' : defaultNurseryId ? 'nursery' : null)
      }
      defaultBedId={defaultBedId}
      defaultNurseryId={defaultNurseryId}
      creationContext={quickContextRes.ok ? quickContextRes.data : undefined}
    />
  );
}
