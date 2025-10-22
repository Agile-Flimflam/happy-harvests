import { PlantingsPageContent } from './_components/PlantingsPageContent'
import { getPlantingsWithDetails, getCropVarietiesForSelect, getBedsForSelect, getNurseriesForSelect } from './_actions'

export default async function PlantingsPage({ searchParams }: { searchParams?: { schedule?: string; mode?: 'nursery' | 'direct' } }) {
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

  const scheduleDate = typeof searchParams?.schedule === 'string' ? searchParams!.schedule : undefined
  const defaultCreateMode = searchParams?.mode === 'nursery' || searchParams?.mode === 'direct' ? searchParams.mode : null

  return (
    <PlantingsPageContent
      plantings={plantings as any}
      cropVarieties={cropVarieties as any}
      beds={beds as any}
      nurseries={nurseries as any}
      scheduleDate={scheduleDate}
      defaultCreateMode={defaultCreateMode}
    />
  )
}


