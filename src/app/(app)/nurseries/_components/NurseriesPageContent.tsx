'use client';

import PageHeader from '@/components/page-header';
import PageContent from '@/components/page-content';
import FormDialog from '@/components/dialogs/FormDialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { useActionState } from 'react';
import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { actionCreateNursery, actionUpdateNursery, type NurseryFormState } from '../_actions';
import type { Tables } from '@/lib/database.types';
import { PlusCircle, Sprout } from 'lucide-react';

type Nursery = Tables<'nurseries'>;
type Location = Tables<'locations'>;

export default function NurseriesPageContent({ nurseries, locations, error }: { nurseries: Nursery[]; locations: Pick<Location, 'id' | 'name'>[]; error?: string }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Nursery | null>(null);
  const initial: NurseryFormState = { message: '' };
  const [, createAction] = useActionState<NurseryFormState, FormData>(actionCreateNursery, initial);
  const [, updateAction] = useActionState<NurseryFormState, FormData>(actionUpdateNursery, initial);

  return (
    <div>
      <PageHeader title="Nurseries" action={<Button size="sm" onClick={() => { setEditing(null); setOpen(true); }}>Add Nursery</Button>} />
      <PageContent>
        {error ? (
          <div className="text-red-500">Error loading nurseries: {error}</div>
        ) : nurseries.length === 0 ? (
          <div className="text-center py-12">
            <div className="mx-auto w-24 h-24 bg-muted rounded-full flex items-center justify-center mb-4">
              <Sprout className="h-12 w-12 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No nurseries yet</h3>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">Add your first nursery to manage seedling starts and transplants.</p>
            <Button size="lg" onClick={() => { setEditing(null); setOpen(true); }}>
              <PlusCircle className="h-5 w-5 mr-2" />
              Add Your First Nursery
            </Button>
          </div>
        ) : (
          <div className="border rounded-md overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {nurseries.map((n: Nursery) => (
                  <TableRow key={n.id}>
                    <TableCell className="font-medium">{n.name}</TableCell>
                    <TableCell>{locations.find((l) => l.id === n.location_id)?.name ?? '—'}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => { setEditing(n); setOpen(true); }}>Edit</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </PageContent>

      <FormDialog
        open={open}
        onOpenChange={setOpen}
        title={editing ? 'Edit Nursery' : 'Add Nursery'}
        description={editing ? 'Update nursery details' : 'Create a new nursery'}
        submitLabel={editing ? 'Save changes' : 'Create nursery'}
        formId="nurseryForm"
      >
        <form id="nurseryForm" action={editing ? updateAction : createAction} className="space-y-4">
          {editing && <input type="hidden" name="id" value={editing.id} />}
          <div>
            <label className="text-sm font-medium">Name</label>
            <Input name="name" defaultValue={editing?.name ?? ''} className="mt-1" required />
          </div>
          <div>
            <label className="text-sm font-medium">Location</label>
            <Select name="location_id" defaultValue={editing?.location_id ?? ''}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select a location" />
              </SelectTrigger>
              <SelectContent>
                {locations.map((l) => (
                  <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium">Notes</label>
            <Textarea name="notes" defaultValue={editing?.notes ?? ''} className="mt-1" rows={3} />
          </div>
        </form>
      </FormDialog>
    </div>
  );
}
