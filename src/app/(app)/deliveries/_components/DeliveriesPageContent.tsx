'use client'

import { useActionState, useEffect, useMemo, useState } from 'react'
import PageHeader from '@/components/page-header'
import PageContent from '@/components/page-content'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Package, Plus, Trash2 } from 'lucide-react'
import FormDialog from '@/components/dialogs/FormDialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { createDelivery, updateDelivery, deleteDelivery, type DeliveryFormState } from '../_actions'
import type { Tables } from '@/lib/database.types'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { toast } from 'sonner'

type Customer = { id: string; name: string }
type Variety = { id: number; name: string; crops?: { name: string } | null }
type DeliveryWithCustomer = Tables<'deliveries'> & { customers?: { name?: string | null } | null }

export function DeliveriesPageContent({ deliveries, customers, varieties }: { deliveries: DeliveryWithCustomer[]; customers: Customer[]; varieties: Variety[] }) {
  const [open, setOpen] = useState(false)
  const initial: DeliveryFormState = { message: '' }
  const [state, formAction] = useActionState(createDelivery, initial)
  const [items, setItems] = useState<{ id: string; crop_variety_id?: number; qty?: number; unit?: string; price_per?: number; total_price?: number }[]>([])
  const [availability, setAvailability] = useState<Record<number, { count_available: number; grams_available: number }>>({})
  const hasDeliveries = deliveries.length > 0
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const addLine = () => setItems((prev) => [...prev, { id: crypto.randomUUID(), unit: 'lbs' }])
  const removeLine = (id: string) => setItems((prev) => prev.filter((l) => l.id !== id))

  const openDelete = (id: string) => setDeleteId(id)
  const confirmDelete = async () => {
    if (!deleteId) return
    try {
      setDeleting(true)
      const result = await deleteDelivery(deleteId)
      if (result.message.startsWith('Database Error:') || result.message.startsWith('Error:')) {
        toast.error(result.message)
      } else {
        toast.success(result.message)
      }
    } finally {
      setDeleting(false)
      setDeleteId(null)
    }
  }

  const itemsJson = useMemo(
    () =>
      JSON.stringify(
        items.map((ln) => ({
          crop_variety_id: ln.crop_variety_id,
          qty: ln.qty,
          unit: ln.unit,
          price_per: ln.price_per,
          total_price: ln.total_price,
        }))
      ),
    [items]
  )

  // Fetch availability for selected varieties
  useEffect(() => {
    const ids = Array.from(new Set(items.map((i) => i.crop_variety_id).filter((v): v is number => typeof v === 'number')))
    if (!ids.length) { setAvailability({}); return }
    const controller = new AbortController()
    const url = `/api/inventory/availability?ids=${ids.join(',')}`
    fetch(url, { cache: 'no-store', signal: controller.signal })
      .then((r) => r.json())
      .then((json) => {
        const map: Record<number, { count_available: number; grams_available: number }> = {}
        for (const row of json.availability || []) {
          map[row.crop_variety_id] = { count_available: row.count_available || 0, grams_available: row.grams_available || 0 }
        }
        setAvailability(map)
      })
      .catch(() => {})
    return () => controller.abort()
  }, [items])

  return (
    <div>
      <PageHeader title="Deliveries" action={hasDeliveries ? <Button size="sm" onClick={() => { setItems([]); setOpen(true) }}>Create Delivery</Button> : undefined} />
      <PageContent>
        {!hasDeliveries ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Package className="size-10" />
              </EmptyMedia>
              <EmptyTitle>No deliveries yet</EmptyTitle>
              <EmptyDescription>
                Log a new delivery to start tracking your first order.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button onClick={() => { setItems([]); setOpen(true) }}>
                <span className="flex items-center gap-1">
                  <Plus className="w-4 h-4" />
                  Create Delivery
                </span>
              </Button>
            </EmptyContent>
          </Empty>
        ) : (
          <div className="border rounded-md overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
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
                        <Select name="payment_status" defaultValue={d.payment_status ?? ''}>
                          <SelectTrigger className="h-8 w-40">
                            <SelectValue placeholder="Payment" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="open">Open</SelectItem>
                            <SelectItem value="sent">Sent</SelectItem>
                            <SelectItem value="partially_paid">Partially Paid</SelectItem>
                            <SelectItem value="paid">Paid</SelectItem>
                            <SelectItem value="deposited">Deposited</SelectItem>
                            <SelectItem value="not_deposited">Not Deposited</SelectItem>
                            <SelectItem value="voided">Voided</SelectItem>
                          </SelectContent>
                        </Select>
                        <Select name="status" defaultValue={d.status ?? ''}>
                          <SelectTrigger className="h-8 w-36">
                            <SelectValue placeholder="Status" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="scheduled">Scheduled</SelectItem>
                            <SelectItem value="delivered">Delivered</SelectItem>
                            <SelectItem value="canceled">Canceled</SelectItem>
                          </SelectContent>
                        </Select>
                        <Input name="payment_terms" defaultValue={d.payment_terms ?? ''} className="h-8 w-24" />
                        <Button type="submit" size="sm" variant="outline">Update</Button>
                      </form>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => openDelete(d.id)} className="text-red-500 hover:text-red-700">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </PageContent>

      <ConfirmDialog
        open={deleteId != null}
        onOpenChange={(open) => { if (!open) setDeleteId(null) }}
        title="Delete delivery?"
        description="This will remove the delivery and its items. This action cannot be undone."
        confirmText="Delete"
        confirmVariant="destructive"
        confirming={deleting}
        onConfirm={confirmDelete}
      />

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
              <Select name="status" defaultValue="">
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="scheduled">Scheduled</SelectItem>
                  <SelectItem value="delivered">Delivered</SelectItem>
                  <SelectItem value="canceled">Canceled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Label>Payment Terms</Label>
              <Input name="payment_terms" placeholder="Net 15" />
            </div>
            <div>
              <Label>Payment Status</Label>
              <Select name="payment_status" defaultValue="">
                <SelectTrigger>
                  <SelectValue placeholder="Select payment status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="sent">Sent</SelectItem>
                  <SelectItem value="partially_paid">Partially Paid</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="deposited">Deposited</SelectItem>
                  <SelectItem value="not_deposited">Not Deposited</SelectItem>
                  <SelectItem value="voided">Voided</SelectItem>
                </SelectContent>
              </Select>
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
              {items.map((ln) => (
                <div key={ln.id} className="grid grid-cols-1 sm:grid-cols-7 gap-2">
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
                  <Select value={ln.unit ?? ''} onValueChange={(v) => setItems((prev) => prev.map((x) => x.id === ln.id ? { ...x, unit: v } : x))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Unit" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="count">Count</SelectItem>
                      <SelectItem value="g">g</SelectItem>
                      <SelectItem value="kg">kg</SelectItem>
                      <SelectItem value="oz">oz</SelectItem>
                      <SelectItem value="lb">lb</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input placeholder="Price per" value={ln.price_per ?? ''} onChange={(e) => setItems((prev) => prev.map((x) => x.id === ln.id ? { ...x, price_per: Number(e.target.value || 0) } : x))} />
                  <Input placeholder="Total" value={ln.total_price ?? ''} onChange={(e) => setItems((prev) => prev.map((x) => x.id === ln.id ? { ...x, total_price: Number(e.target.value || 0) } : x))} />
                  <div className="text-xs text-muted-foreground self-center">
                    {ln.crop_variety_id ? (
                      (() => {
                        const avail = availability[ln.crop_variety_id!]
                        if (!avail) return null
                        const kg = (avail.grams_available / 1000).toFixed(2)
                        return (
                          <span aria-label={`Available inventory: ${avail.count_available} count and ${kg} kilograms`}>
                            Avail: {avail.count_available} ct / {kg} kg
                          </span>
                        )
                      })()
                    ) : null}
                  </div>
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


