'use client';

import PageHeader from '@/components/page-header';
import PageContent from '@/components/page-content';
import FormDialog from '@/components/dialogs/FormDialog';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { useActionState } from 'react';
import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { actionCreateNursery, actionUpdateNursery, actionDeleteNursery, type NurseryFormState } from '../_actions';
import type { Tables } from '@/lib/database.types';
import { PlusCircle, Sprout, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

type Nursery = Tables<'nurseries'>;
type Location = Tables<'locations'>;

export default function NurseriesPageContent({ nurseries, locations, error }: { nurseries: Nursery[]; locations: Pick<Location, 'id' | 'name'>[]; error?: string }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Nursery | null>(null);
  const [name, setName] = useState<string>('');
  const [locationId, setLocationId] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [fieldErrors, setFieldErrors] = useState<{ name?: string; location_id?: string }>({});
  const initial: NurseryFormState = { message: '' };
  const [createState, createAction] = useActionState<NurseryFormState, FormData>(actionCreateNursery, initial);
  const [updateState, updateAction] = useActionState<NurseryFormState, FormData>(actionUpdateNursery, initial);
  const [deleteTarget, setDeleteTarget] = useState<Nursery | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Initialize/reset form state when opening dialog
  useEffect(() => {
    if (open) {
      setName(editing?.name ?? '');
      setLocationId(editing?.location_id ?? '');
      setNotes(editing?.notes ?? '');
      setFieldErrors({});
    } else {
      setName('');
      setLocationId('');
      setNotes('');
      setFieldErrors({});
    }
  }, [open, editing]);

  useEffect(() => {
    const state = editing ? updateState : createState;
    if (!state?.message) return;
    const successMessages = new Set(['Nursery created.', 'Nursery updated.']);
    if (!successMessages.has(state.message)) {
      // Map server-side field errors for highlighting when present
      if (state.errors) {
        setFieldErrors({
          name: state.errors.name?.[0],
          location_id: state.errors.location_id?.[0],
        });
      }
      toast.error(state.message);
      return;
    }
    toast.success(state.message);
    setOpen(false);
    setEditing(null);
  }, [createState, updateState, editing]);

  const openDelete = (n: Nursery) => setDeleteTarget(n);
  const confirmDelete = async () => {
    if (deleteTarget == null) return;
    try {
      setDeleting(true);
      const result = await actionDeleteNursery(deleteTarget.id);
      if ('error' in result && result.error) {
        toast.error(result.error);
      } else {
        toast.success('Nursery deleted.');
      }
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

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
                    <TableCell className="text-right whitespace-nowrap">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => { setEditing(n); setOpen(true); }}
                        aria-label="Edit nursery"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openDelete(n)}
                        className="text-red-500 hover:text-red-700"
                        aria-label="Delete nursery"
                      >
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

      {/* Single confirm dialog instance to avoid stacked overlays and include deterministic copy */}
      <ConfirmDialog
        open={deleteTarget != null}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        title='Delete nursery?'
        description={
          deleteTarget ? (
            <span>
              Are you sure you want to delete <strong>{deleteTarget.name}</strong>? This action cannot be undone. You must remove or reassign any associated records first.
            </span>
          ) : (
            'This action cannot be undone.'
          )
        }
        confirmText="Delete"
        confirmVariant="destructive"
        confirming={deleting}
        onConfirm={confirmDelete}
      />

      <FormDialog
        open={open}
        onOpenChange={setOpen}
        title={editing ? 'Edit Nursery' : 'Add Nursery'}
        description={editing ? 'Update nursery details' : 'Create a new nursery'}
        submitLabel={editing ? 'Save changes' : 'Create nursery'}
        formId="nurseryForm"
      >
        <form
          id="nurseryForm"
          action={editing ? updateAction : createAction}
          className="space-y-4"
          noValidate
          onSubmit={(e) => {
            const errors: { name?: string; location_id?: string } = {};
            if (!name.trim()) errors.name = 'Name is required';
            if (!locationId) errors.location_id = 'Location is required';
            if (errors.name || errors.location_id) {
              e.preventDefault();
              setFieldErrors(errors);
              toast.error('Please fix the highlighted fields.');
            } else {
              setFieldErrors({});
            }
          }}
        >
          {editing && <input type="hidden" name="id" value={editing.id} />}
          <div>
            <label className="text-sm font-medium">Name</label>
            <Input
              name="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={`mt-1 ${fieldErrors.name ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
              aria-invalid={fieldErrors.name ? 'true' : undefined}
            />
            {fieldErrors.name ? (
              <p className="text-destructive text-sm mt-1">{fieldErrors.name}</p>
            ) : null}
          </div>
          <div>
            <label className="text-sm font-medium">Location</label>
            {/* Hidden input carries selected value from shadcn Select to server action */}
            <input type="hidden" name="location_id" value={locationId} />
            <Select value={locationId} onValueChange={(v) => setLocationId(v)}>
              <SelectTrigger className={`mt-1 ${fieldErrors.location_id ? 'border-red-500 focus-visible:ring-red-500' : ''}`}>
                <SelectValue placeholder="Select a location" />
              </SelectTrigger>
              <SelectContent>
                {locations.map((l) => (
                  <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {fieldErrors.location_id ? (
              <p className="text-destructive text-sm mt-1">{fieldErrors.location_id}</p>
            ) : null}
          </div>
          <div>
            <label className="text-sm font-medium">Notes</label>
            <Textarea name="notes" value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-1" rows={3} />
          </div>
        </form>
      </FormDialog>
    </div>
  );
}
