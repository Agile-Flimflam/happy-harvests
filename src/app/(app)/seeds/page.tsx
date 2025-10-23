import { SeedsPageContent } from './_components/SeedsPageContent'
import { getSeeds, getCropVarietiesForSelect, syncSeedsToVarieties } from '@/app/(app)/seeds/_actions'
import type { Tables } from '@/lib/database.types'

type VarietyForSelect = { id: number; name: string; latin_name: string; crops?: { name: string } | null }

export default async function SeedsPage() {
  await syncSeedsToVarieties()
  const [{ seeds = [] }, { varieties = [] }] = await Promise.all([
    getSeeds(),
    getCropVarietiesForSelect(),
  ])
  return <SeedsPageContent seeds={seeds as Tables<'seeds'>[]} varieties={varieties as VarietyForSelect[]} />
}


