import { SeedsPageContent } from './_components/SeedsPageContent'
import { getSeeds, getCropVarietiesForSelect, syncSeedsToVarieties } from './_actions'

export default async function SeedsPage() {
  await syncSeedsToVarieties()
  const [{ seeds = [] }, { varieties = [] }] = await Promise.all([
    getSeeds(),
    getCropVarietiesForSelect(),
  ])
  return <SeedsPageContent seeds={seeds as any} varieties={varieties as any} />
}


