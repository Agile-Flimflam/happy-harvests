'use client'

import { useActionState, useState } from 'react'
import { Button } from '@/components/ui/button'
import PageHeader from '@/components/page-header'
import PageContent from '@/components/page-content'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import FormDialog from '@/components/dialogs/FormDialog'
import { upsertSeed, deleteSeed, type SeedFormState } from '../_actions'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { Tables } from '@/lib/database.types'
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Bean, Plus } from 'lucide-react'

type Variety = { id: number; name: string; latin_name: string; crops?: { name: string } | null }
type Seed = Tables<'seeds'>

export function SeedsPageContent({ seeds, varieties }: { seeds: Seed[]; varieties: Variety[] }) {
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Seed | null>(null)
  const initial: SeedFormState = { message: '' }
  const [state, formAction] = useActionState(upsertSeed, initial)

  const startCreate = () => { setEditing(null); setOpen(true) }
  const startEdit = (seed: Seed) => { setEditing(seed); setOpen(true) }
  const hasSeeds = seeds.length > 0

  return (
    <div>
      <PageHeader title="Seeds" action={hasSeeds ? <Button size="sm" onClick={startCreate}>Add Seed</Button> : undefined} />
      <PageContent>
        {!hasSeeds ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Bean className="size-10" />
              </EmptyMedia>
              <EmptyTitle>No seeds yet</EmptyTitle>
              <EmptyDescription>
                Track seeds you have purchased or acquired to plan plantings and inventory.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <div className="flex gap-2 justify-center">
                <Button onClick={startCreate}>
                  <span className="flex items-center gap-1">
                    <Plus className="w-4 h-4" />
                    Add Seed
                  </span>
                </Button>
              </div>
            </EmptyContent>
          </Empty>
        ) : (
          <div className="border rounded-md overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Crop</TableHead>
                  <TableHead>Variety</TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead>LOT</TableHead>
                  <TableHead>Received</TableHead>
                  <TableHead>Qty</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {seeds.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>{s.crop_name}</TableCell>
                    <TableCell>{s.variety_name}</TableCell>
                    <TableCell>{s.vendor || '-'}</TableCell>
                    <TableCell>{s.lot_number || '-'}</TableCell>
                    <TableCell>{s.date_received || '-'}</TableCell>
                    <TableCell>{typeof s.quantity === 'number' ? `${s.quantity} ${s.quantity_units || ''}` : '-'}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" onClick={() => startEdit(s)}>Edit</Button>
                      <form action={deleteSeed} className="inline-block ml-2">
                        <input type="hidden" name="id" value={s.id} />
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

      <FormDialog open={open} onOpenChange={setOpen} title={editing ? 'Edit Seed' : 'Add Seed'} description="Log seeds purchased or acquired" submitLabel="Save" formId="seedForm">
        <form id="seedForm" action={formAction} className="space-y-3">
          {editing ? <input type="hidden" name="id" value={editing.id} /> : null}
          <div>
            <Label htmlFor="crop_variety_id">Crop Variety</Label>
            <Select name="crop_variety_id" defaultValue={String(editing?.crop_variety_id ?? '')}>
              <SelectTrigger>
                <SelectValue placeholder="Select a crop variety" />
              </SelectTrigger>
              <SelectContent>
                {varieties.map((v) => (
                  <SelectItem key={v.id} value={String(v.id)}>{v.crops?.name ? `${v.crops.name} — ${v.name}` : v.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="crop_name">Crop Name</Label>
              <Input name="crop_name" id="crop_name" defaultValue={editing?.crop_name || ''} required />
            </div>
            <div>
              <Label htmlFor="variety_name">Variety</Label>
              <Input name="variety_name" id="variety_name" defaultValue={editing?.variety_name || ''} />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Label htmlFor="vendor">Vendor</Label>
              <Input name="vendor" id="vendor" defaultValue={editing?.vendor || ''} />
            </div>
            <div>
              <Label htmlFor="lot_number">LOT Number</Label>
              <Input name="lot_number" id="lot_number" defaultValue={editing?.lot_number || ''} />
            </div>
            <div>
              <Label htmlFor="date_received">Date Received</Label>
              <Input type="date" name="date_received" id="date_received" defaultValue={editing?.date_received || ''} />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Label htmlFor="quantity">Quantity</Label>
              <Input type="number" name="quantity" id="quantity" defaultValue={editing?.quantity ?? ''} />
            </div>
            <div>
              <Label htmlFor="quantity_units">Units</Label>
              <Input name="quantity_units" id="quantity_units" defaultValue={editing?.quantity_units || ''} placeholder="packets, seeds, lbs, etc." />
            </div>
            <div>
              <Label htmlFor="notes">Notes</Label>
              <Input name="notes" id="notes" defaultValue={editing?.notes || ''} />
            </div>
          </div>
          {state.message ? <div className="text-sm text-muted-foreground">{state.message}</div> : null}
        </form>
      </FormDialog>
    </div>
  )
}


