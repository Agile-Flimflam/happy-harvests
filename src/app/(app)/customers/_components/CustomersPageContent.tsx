'use client'

import { useActionState, useState } from 'react'
import PageHeader from '@/components/page-header'
import PageContent from '@/components/page-content'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Users, Plus } from 'lucide-react'
import FormDialog from '@/components/dialogs/FormDialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { upsertCustomer, deleteCustomer, type CustomerFormState } from '../_actions'
import type { Tables } from '@/lib/database.types'

export function CustomersPageContent({ customers }: { customers: Tables<'customers'>[] }) {
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Tables<'customers'> | null>(null)
  const initial: CustomerFormState = { message: '' }
  const [state, formAction] = useActionState(upsertCustomer, initial)
  const hasCustomers = customers.length > 0

  return (
    <div>
      <PageHeader title="Customers" action={hasCustomers ? <Button size="sm" onClick={() => { setEditing(null); setOpen(true) }}>Add Customer</Button> : undefined} />
      <PageContent>
        {!hasCustomers ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Users className="size-10" />
              </EmptyMedia>
              <EmptyTitle>No customers yet</EmptyTitle>
              <EmptyDescription>
                Add your first customer to track orders and deliveries.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button onClick={() => { setEditing(null); setOpen(true) }}>
                <span className="flex items-center gap-1">
                  <Plus className="w-4 h-4" />
                  Add Customer
                </span>
              </Button>
            </EmptyContent>
          </Empty>
        ) : (
          <div className="border rounded-md overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Website</TableHead>
                  <TableHead>Billing (City, State)</TableHead>
                  <TableHead>Shipping (City, State)</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customers.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell>{c.phone || '-'}</TableCell>
                    <TableCell>{c.email || '-'}</TableCell>
                    <TableCell>{c.website || '-'}</TableCell>
                    <TableCell>{[c.billing_city, c.billing_state].filter(Boolean).join(', ') || '-'}</TableCell>
                    <TableCell>{[c.shipping_city, c.shipping_state].filter(Boolean).join(', ') || '-'}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" onClick={() => { setEditing(c); setOpen(true) }}>Edit</Button>
                      <form action={deleteCustomer} className="inline-block ml-2">
                        <input type="hidden" name="id" value={c.id} />
                        <Button variant="destructive" size="sm" type="submit">Delete</Button>
                      </form>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </PageContent>

      <FormDialog open={open} onOpenChange={setOpen} title={editing ? 'Edit Customer' : 'Add Customer'} description="Track your customers' details" submitLabel="Save" formId="customerForm">
        <form id="customerForm" action={formAction} className="space-y-3">
          {editing ? <input type="hidden" name="id" value={editing.id} /> : null}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" required defaultValue={editing?.name || ''} />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" defaultValue={editing?.email || ''} />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" name="phone" defaultValue={editing?.phone || ''} />
            </div>
            <div>
              <Label htmlFor="fax">Fax</Label>
              <Input id="fax" name="fax" defaultValue={editing?.fax || ''} />
            </div>
            <div>
              <Label htmlFor="website">Website</Label>
              <Input id="website" name="website" defaultValue={editing?.website || ''} />
            </div>
          </div>
          <div>
            <Label>Billing Address</Label>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mt-1">
              <Input name="billing_street" placeholder="Street" defaultValue={editing?.billing_street || ''} />
              <Input name="billing_city" placeholder="City" defaultValue={editing?.billing_city || ''} />
              <Input name="billing_state" placeholder="State" defaultValue={editing?.billing_state || ''} />
              <Input name="billing_zip" placeholder="ZIP" defaultValue={editing?.billing_zip || ''} />
            </div>
          </div>
          <div>
            <Label>Shipping Address</Label>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mt-1">
              <Input name="shipping_street" placeholder="Street" defaultValue={editing?.shipping_street || ''} />
              <Input name="shipping_city" placeholder="City" defaultValue={editing?.shipping_city || ''} />
              <Input name="shipping_state" placeholder="State" defaultValue={editing?.shipping_state || ''} />
              <Input name="shipping_zip" placeholder="ZIP" defaultValue={editing?.shipping_zip || ''} />
            </div>
          </div>
          <div>
            <Label htmlFor="notes">Notes</Label>
            <Input id="notes" name="notes" defaultValue={editing?.notes || ''} />
          </div>
          {state.message ? <div className="text-sm text-muted-foreground">{state.message}</div> : null}
        </form>
      </FormDialog>
    </div>
  )
}


