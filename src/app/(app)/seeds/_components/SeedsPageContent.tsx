'use client';

import { useActionState, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { upsertSeed, deleteSeed, type SeedFormState } from '../_actions';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Tables } from '@/lib/database.types';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { Bean, Plus } from 'lucide-react';
import { setupFormControlProperty } from '@/lib/form-utils';
import { FlowShell } from '@/components/ui/flow-shell';
import { InlineCreateSheet } from '@/components/ui/inline-create-sheet';
import { StickyActionBar } from '@/components/ui/sticky-action-bar';
import { useIsMobile } from '@/hooks/use-mobile';

type Variety = { id: number; name: string; latin_name: string; crops?: { name: string } | null };
type Seed = Tables<'seeds'>;

export function SeedsPageContent({ seeds, varieties }: { seeds: Seed[]; varieties: Variety[] }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Seed | null>(null);
  const [cropVarietyId, setCropVarietyId] = useState<string>('');
  const initial: SeedFormState = { message: '' };
  const [state, formAction] = useActionState(upsertSeed, initial);
  const formRef = useRef<HTMLFormElement>(null);

  const startCreate = () => {
    setEditing(null);
    setOpen(true);
  };
  const startEdit = (seed: Seed) => {
    setEditing(seed);
    setOpen(true);
  };
  const hasSeeds = seeds.length > 0;
  const isMobile = useIsMobile();

  // Avoid browser extension crashes by ensuring form.control exists
  useLayoutEffect(() => {
    setupFormControlProperty(formRef.current);
  }, []);

  // Initialize form values when dialog opens
  useEffect(() => {
    if (open) {
      setCropVarietyId(editing?.crop_variety_id != null ? String(editing.crop_variety_id) : '');
    } else {
      setCropVarietyId('');
    }
  }, [open, editing]);

  return (
    <div>
      <FlowShell
        title="Seeds"
        description="Track purchased or acquired seeds with vendors and LOT details."
        icon={<Bean className="h-5 w-5" aria-hidden />}
        actions={
          hasSeeds && !isMobile ? (
            <Button size="sm" onClick={startCreate}>
              Add Seed
            </Button>
          ) : undefined
        }
      >
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
                    <TableCell>
                      {typeof s.quantity === 'number'
                        ? `${s.quantity} ${s.quantity_units || ''}`
                        : '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" onClick={() => startEdit(s)}>
                        Edit
                      </Button>
                      <form action={deleteSeed} className="inline-block ml-2">
                        <input type="hidden" name="id" value={s.id} />
                        <Button variant="destructive" size="sm" type="submit">
                          Delete
                        </Button>
                      </form>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </FlowShell>

      <InlineCreateSheet
        open={open}
        onOpenChange={setOpen}
        title={editing ? 'Edit Seed' : 'Add Seed'}
        description="Log seeds purchased or acquired"
        primaryAction={{ label: 'Save', formId: 'seedForm' }}
        secondaryAction={{ label: 'Cancel', onClick: () => setOpen(false) }}
        footerContent="Sheets respect mobile safe areas for actions."
        side="bottom"
      >
        <form id="seedForm" ref={formRef} action={formAction} className="space-y-3">
          {editing ? <input type="hidden" name="id" value={editing.id} /> : null}
          <div>
            <Label htmlFor="crop_variety_id">Crop Variety</Label>
            <input type="hidden" name="crop_variety_id" value={cropVarietyId} />
            <Select value={cropVarietyId} onValueChange={(value) => setCropVarietyId(value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select a crop variety" />
              </SelectTrigger>
              <SelectContent>
                {varieties.map((v) => (
                  <SelectItem key={v.id} value={String(v.id)}>
                    {v.crops?.name ? `${v.crops.name} — ${v.name}` : v.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="crop_name">Crop Name</Label>
              <Input
                name="crop_name"
                id="crop_name"
                defaultValue={editing?.crop_name || ''}
                required
              />
            </div>
            <div>
              <Label htmlFor="variety_name">Variety</Label>
              <Input
                name="variety_name"
                id="variety_name"
                defaultValue={editing?.variety_name || ''}
              />
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
              <Input
                type="date"
                name="date_received"
                id="date_received"
                defaultValue={editing?.date_received || ''}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Label htmlFor="quantity">Quantity</Label>
              <Input
                type="number"
                name="quantity"
                id="quantity"
                defaultValue={editing?.quantity ?? ''}
              />
            </div>
            <div>
              <Label htmlFor="quantity_units">Units</Label>
              <Input
                name="quantity_units"
                id="quantity_units"
                defaultValue={editing?.quantity_units || ''}
                placeholder="packets, seeds, lbs, etc."
              />
            </div>
            <div>
              <Label htmlFor="notes">Notes</Label>
              <Input name="notes" id="notes" defaultValue={editing?.notes || ''} />
            </div>
          </div>
          {state.message ? (
            <div className="text-sm text-muted-foreground">{state.message}</div>
          ) : null}
        </form>
      </InlineCreateSheet>

      {hasSeeds && isMobile ? (
        <StickyActionBar align="end" aria-label="Quick add seed" position="fixed">
          <Button onClick={startCreate} className="w-full sm:w-auto">
            <Plus className="h-4 w-4 mr-2" aria-hidden />
            Add Seed
          </Button>
        </StickyActionBar>
      ) : null}
    </div>
  );
}
