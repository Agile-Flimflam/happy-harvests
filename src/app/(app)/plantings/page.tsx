import { PlantingsPageContent } from './_components/PlantingsPageContent'
import { getPlantingsWithDetails, getCropVarietiesForSelect, getBedsForSelect, getNurseriesForSelect } from './_actions'
import type { Tables } from '@/lib/supabase-server'
import type { PlantingWithDetails } from '@/lib/types'

type CropVariety = Pick<Tables<'crop_varieties'>, 'id' | 'name' | 'latin_name'> & { crops?: { name: string } | null }
type Bed = Pick<Tables<'beds'>, 'id' | 'length_inches' | 'width_inches'> & { plots?: { locations: { name: string } | null } | null }
type Nursery = { id: string; name: string }

export default async function PlantingsPage({ searchParams }: { searchParams?: Promise<{ schedule?: string; mode?: 'nursery' | 'direct' }> }) {
  const [plantingsRes, varietiesRes, bedsRes, nurseriesRes] = await Promise.all([
    getPlantingsWithDetails(),
    getCropVarietiesForSelect(),
    getBedsForSelect(),
    getNurseriesForSelect(),
  ])

  const plantings = plantingsRes.plantings || []
  const cropVarieties = varietiesRes.varieties || []
  const beds = bedsRes.beds || []
  const nurseries = nurseriesRes.nurseries || []

  const sp = searchParams ? await searchParams : undefined
  const scheduleDate = typeof sp?.schedule === 'string' ? sp.schedule : undefined
  const defaultCreateMode = sp?.mode === 'nursery' || sp?.mode === 'direct' ? sp.mode : null

  return (
    <PlantingsPageContent
      plantings={plantings as PlantingWithDetails[]}
      cropVarieties={cropVarieties as CropVariety[]}
      beds={beds as Bed[]}
      nurseries={nurseries as Nursery[]}
      scheduleDate={scheduleDate}
      defaultCreateMode={defaultCreateMode}
    />
  )
}


