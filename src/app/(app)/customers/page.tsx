import { CustomersPageContent } from './_components/CustomersPageContent'
import { listCustomers } from './_actions'
import type { Tables } from '@/lib/database.types'

export default async function CustomersPage() {
  const { customers = [] } = await listCustomers()
  return <CustomersPageContent customers={customers as Tables<'customers'>[]} />
}


