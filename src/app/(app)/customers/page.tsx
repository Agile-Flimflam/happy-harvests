import { CustomersPageContent } from './_components/CustomersPageContent'
import { listCustomers } from './_actions'

export default async function CustomersPage() {
  const { customers = [] } = await listCustomers()
  return <CustomersPageContent customers={customers as any[]} />
}


