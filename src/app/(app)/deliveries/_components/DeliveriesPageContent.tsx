'use client'

import { useActionState, useMemo, useState } from 'react'
import PageHeader from '@/components/page-header'
import PageContent from '@/components/page-content'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import FormDialog from '@/components/dialogs/FormDialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { createDelivery, updateDelivery, type DeliveryFormState } from '../_actions'

type Customer = { id: string; name: string }
type Variety = { id: number; name: string; crops?: { name: string } | null }

export function DeliveriesPageContent({ deliveries, customers, varieties }: { deliveries: any[]; customers: Customer[]; varieties: Variety[] }) {
  const [open, setOpen] = useState(false)
  const initial: DeliveryFormState = { message: '' }
  const [state, formAction] = useActionState(createDelivery, initial)
  const [items, setItems] = useState<{ id: string; crop_variety_id?: number; qty?: number; unit?: string; price_per?: number; total_price?: number }[]>([])

  const addLine = () => setItems((prev) => [...prev, { id: crypto.randomUUID(), unit: 'lbs' }])
  const removeLine = (id: string) => setItems((prev) => prev.filter((l) => l.id !== id))

  const itemsJson = useMemo(() => JSON.stringify(items.map(({ id, ...rest }) => rest)), [items])

  return (
    <div>
      <PageHeader title="Deliveries" action={<Button size="sm" onClick={() => { setItems([]); setOpen(true) }}>Create Delivery</Button>} />
      <PageContent>
        <div className="border rounded-md overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Payment</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {deliveries.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="font-medium">{d.delivery_date}</TableCell>
                  <TableCell>{d.customers?.name ?? '-'}</TableCell>
                  <TableCell>{d.status ?? '-'}</TableCell>
                  <TableCell>
                    <form action={updateDelivery} className="inline-flex items-center gap-2">
                      <input type="hidden" name="id" value={d.id} />
                      <Input name="payment_status" defaultValue={d.payment_status ?? ''} className="h-8 w-28" />
                      <Input name="status" defaultValue={d.status ?? ''} className="h-8 w-28" />
                      <Input name="payment_terms" defaultValue={d.payment_terms ?? ''} className="h-8 w-24" />
                      <Button type="submit" size="sm" variant="outline">Update</Button>
                    </form>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </PageContent>

      <FormDialog open={open} onOpenChange={setOpen} title="Create Delivery" description="Relate harvests to a customer with pricing" submitLabel="Save" formId="deliveryForm">
        <form id="deliveryForm" action={formAction} className="space-y-3">
          <input type="hidden" name="items_json" value={itemsJson} />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Label>Customer</Label>
              <Select name="customer_id" defaultValue="">
                <SelectTrigger>
                  <SelectValue placeholder="Select customer" />
                </SelectTrigger>
                <SelectContent>
                  {customers.map((c) => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Date</Label>
              <Input type="date" name="delivery_date" />
            </div>
            <div>
              <Label>Status</Label>
              <Input name="status" placeholder="scheduled" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Label>Payment Terms</Label>
              <Input name="payment_terms" placeholder="Net 15" />
            </div>
            <div>
              <Label>Payment Status</Label>
              <Input name="payment_status" placeholder="invoiced" />
            </div>
            <div>
              <Label>Notes</Label>
              <Input name="notes" />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Items</Label>
              <Button type="button" size="sm" onClick={addLine}>Add Item</Button>
            </div>
            <div className="space-y-2">
              {items.map((ln, idx) => (
                <div key={ln.id} className="grid grid-cols-1 sm:grid-cols-6 gap-2">
                  <div className="sm:col-span-2">
                    <Select value={ln.crop_variety_id ? String(ln.crop_variety_id) : ''} onValueChange={(v) => setItems((prev) => prev.map((x) => x.id === ln.id ? { ...x, crop_variety_id: parseInt(v, 10) } : x))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Variety" />
                      </SelectTrigger>
                      <SelectContent>
                        {varieties.map((v) => (<SelectItem key={v.id} value={String(v.id)}>{v.crops?.name ? `${v.crops.name} — ${v.name}` : v.name}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Input placeholder="Qty" value={ln.qty ?? ''} onChange={(e) => setItems((prev) => prev.map((x) => x.id === ln.id ? { ...x, qty: Number(e.target.value || 0) } : x))} />
                  <Input placeholder="Unit" value={ln.unit ?? ''} onChange={(e) => setItems((prev) => prev.map((x) => x.id === ln.id ? { ...x, unit: e.target.value } : x))} />
                  <Input placeholder="Price per" value={ln.price_per ?? ''} onChange={(e) => setItems((prev) => prev.map((x) => x.id === ln.id ? { ...x, price_per: Number(e.target.value || 0) } : x))} />
                  <Input placeholder="Total" value={ln.total_price ?? ''} onChange={(e) => setItems((prev) => prev.map((x) => x.id === ln.id ? { ...x, total_price: Number(e.target.value || 0) } : x))} />
                  <Button type="button" variant="destructive" onClick={() => removeLine(ln.id)}>Remove</Button>
                </div>
              ))}
            </div>
          </div>

          {state.message ? <div className="text-sm text-muted-foreground">{state.message}</div> : null}
        </form>
      </FormDialog>
    </div>
  )
}


