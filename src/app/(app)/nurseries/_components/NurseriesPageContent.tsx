'use client';

import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  actionCreateNursery,
  actionUpdateNursery,
  actionDeleteNursery,
  type NurseryFormState,
  type NurseryStats,
} from '../_actions';
import type { Tables } from '@/lib/database.types';
import { Plus, FlaskConical, Pencil, Trash2, Sprout } from 'lucide-react';
import { toast } from 'sonner';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { setupFormControlProperty, setupGlobalFormControlListener } from '@/lib/form-utils';
import { FlowShell } from '@/components/ui/flow-shell';
import { InlineCreateSheet } from '@/components/ui/inline-create-sheet';
import { StickyActionBar } from '@/components/ui/sticky-action-bar';
import { useIsMobile } from '@/hooks/use-mobile';
import { NurserySowForm } from '@/app/(app)/plantings/_components/NurserySowForm';
import { CropVarietyForm } from '@/app/(app)/crop-varieties/_components/CropVarietyForm';
import { useRetryableActionState } from '@/hooks/use-retryable-action';

type Nursery = Tables<'nurseries'>;
type Location = Tables<'locations'>;
type CropVarietyLite = {
  id: number;
  name: string;
  latin_name: string;
  crops?: { name: string } | null;
};
type CropLite = Pick<Tables<'crops'>, 'id' | 'name' | 'crop_type' | 'created_at'>;

export default function NurseriesPageContent({
  nurseries,
  locations,
  cropVarieties,
  crops,
  stats,
  error,
}: {
  nurseries: Nursery[];
  locations: Pick<Location, 'id' | 'name'>[];
  cropVarieties: CropVarietyLite[];
  crops: CropLite[];
  stats?: NurseryStats;
  error?: string;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Nursery | null>(null);
  const [name, setName] = useState<string>('');
  const [locationId, setLocationId] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [fieldErrors, setFieldErrors] = useState<{ name?: string; location_id?: string }>({});
  const initial: NurseryFormState = {
    ok: true,
    data: { nursery: null },
    message: '',
    correlationId: 'init',
  };
  const { state: createState, dispatch: createAction } = useRetryableActionState<
    NurseryFormState,
    FormData
  >(actionCreateNursery, initial);
  const { state: updateState, dispatch: updateAction } = useRetryableActionState<
    NurseryFormState,
    FormData
  >(actionUpdateNursery, initial);
  const [nurseriesState, setNurseriesState] = useState<Nursery[]>(nurseries);
  const [cropVarietiesState, setCropVarietiesState] = useState<CropVarietyLite[]>(cropVarieties);
  const [deleteTarget, setDeleteTarget] = useState<Nursery | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [sowOpen, setSowOpen] = useState(false);
  const [selectedNurseryId, setSelectedNurseryId] = useState<string | null>(
    nurseries[0]?.id ?? null
  );
  const [varietySheetOpen, setVarietySheetOpen] = useState(false);
  const [pendingVarietyId, setPendingVarietyId] = useState<number | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const hasNurseries = nurseriesState.length > 0;
  const dialogDescription = editing
    ? 'Update nursery name, location, and optional notes.'
    : 'Add a nursery by providing name, location, and optional notes.';

  // Global safety for aggressive browser extensions
  useEffect(() => {
    setupGlobalFormControlListener();
  }, []); // run once on mount to avoid duplicate listeners

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

  // Ensure browser extensions see a form.control property to avoid runtime errors
  useLayoutEffect(() => {
    if (!open) return;
    const formEl = formRef.current;
    if (!formEl) return;
    setupFormControlProperty(formEl);
  }, [open]);

  useEffect(() => {
    const state = editing ? updateState : createState;
    if (!state?.message) return;
    if (!state.ok) {
      const errors = state.fieldErrors ?? {};
      setFieldErrors({
        name: errors.name?.[0],
        location_id: errors.location_id?.[0],
      });
      const ref = state.correlationId ? ` (Ref: ${state.correlationId})` : '';
      toast.error(`${state.message}${ref}`);
      return;
    }
    const updatedNursery = state.data?.nursery ?? undefined;
    if (updatedNursery) {
      setNurseriesState((prev) => {
        const exists = prev.find((n) => n.id === updatedNursery.id);
        if (exists) {
          return prev.map((n) => (n.id === updatedNursery.id ? updatedNursery : n));
        }
        return [...prev, updatedNursery].sort((a, b) => a.name.localeCompare(b.name));
      });
      setSelectedNurseryId(updatedNursery.id);
      if (!editing) {
        setSowOpen(true);
      }
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
      if (!result.ok) {
        const ref = result.correlationId ? ` (Ref: ${result.correlationId})` : '';
        toast.error(`${result.message}${ref}`);
      } else {
        toast.success(result.message);
        setNurseriesState((prev) => prev.filter((n) => n.id !== deleteTarget.id));
      }
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  const handleOpenSow = (nurseryId?: string | null) => {
    const targetId = nurseryId ?? selectedNurseryId ?? nurseriesState[0]?.id ?? null;
    if (!targetId) {
      toast.error('Add a nursery first.');
      return;
    }
    setSelectedNurseryId(targetId);
    setSowOpen(true);
  };

  const isMobile = useIsMobile();
  const nurseryOptions = nurseriesState.map((n) => ({ id: n.id, name: n.name }));
  const defaultSowDate = new Date().toISOString().slice(0, 10);

  return (
    <div>
      <FlowShell
        title="Nurseries"
        description="Manage seedling starts and their locations."
        icon={<FlaskConical className="h-5 w-5" aria-hidden />}
        actions={
          !isMobile ? (
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setEditing(null);
                  setOpen(true);
                }}
              >
                Add Nursery
              </Button>
              <Button
                size="sm"
                onClick={() => handleOpenSow(selectedNurseryId)}
                disabled={!hasNurseries}
              >
                Record Nursery Sow
              </Button>
            </div>
          ) : undefined
        }
      >
        {error ? (
          <div className="text-red-500">Error loading nurseries: {error}</div>
        ) : !hasNurseries ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <FlaskConical className="size-10" />
              </EmptyMedia>
              <EmptyTitle>No nurseries yet</EmptyTitle>
              <EmptyDescription>
                Add your first nursery to manage seedling starts and transplants.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button
                onClick={() => {
                  setEditing(null);
                  setOpen(true);
                }}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Your First Nursery
              </Button>
            </EmptyContent>
          </Empty>
        ) : (
          <div className="space-y-4">
            {isMobile ? (
              <div className="grid gap-3">
                {nurseriesState.map((n) => {
                  const stat = stats?.[n.id];
                  const locationName = locations.find((l) => l.id === n.location_id)?.name ?? '—';
                  return (
                    <Card key={n.id} className="shadow-sm border">
                      <CardHeader className="pb-2">
                        <CardTitle className="flex items-center justify-between text-base">
                          <span className="truncate">{n.name}</span>
                          <Badge variant="secondary">Nursery</Badge>
                        </CardTitle>
                        <p className="text-sm text-muted-foreground">{locationName}</p>
                      </CardHeader>
                      <CardContent className="space-y-2 text-sm">
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Active sowings</span>
                          <span className="font-semibold">{stat?.activeSows ?? 0}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Last sow</span>
                          <span className="font-semibold">
                            {stat?.lastSowDate ?? 'Not recorded'}
                          </span>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" className="flex-1" onClick={() => handleOpenSow(n.id)}>
                            <Sprout className="h-3 w-3 mr-1" aria-hidden />
                            Record sow
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setEditing(n);
                              setOpen(true);
                            }}
                          >
                            Edit
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : null}
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
                  {nurseriesState.map((n: Nursery) => (
                    <TableRow key={n.id}>
                      <TableCell className="font-medium">{n.name}</TableCell>
                      <TableCell>
                        {locations.find((l) => l.id === n.location_id)?.name ?? '—'}
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        <Button
                          variant="outline"
                          size="sm"
                          className="mr-2 gap-1"
                          aria-label={`Record sow in ${n.name}`}
                          onClick={() => handleOpenSow(n.id)}
                        >
                          <Sprout className="h-3 w-3" aria-hidden />
                          Record sow here
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setEditing(n);
                            setOpen(true);
                          }}
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
          </div>
        )}
      </FlowShell>

      {/* Single confirm dialog instance to avoid stacked overlays and include deterministic copy */}
      <ConfirmDialog
        open={deleteTarget != null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title="Delete nursery?"
        description={
          deleteTarget ? (
            <span>
              Are you sure you want to delete <strong>{deleteTarget.name}</strong>? This action
              cannot be undone. You must remove or reassign any associated records first.
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

      <InlineCreateSheet
        open={open}
        onOpenChange={setOpen}
        title={editing ? 'Edit Nursery' : 'Add Nursery'}
        description={dialogDescription}
        primaryAction={{
          label: editing ? 'Save changes' : 'Create nursery',
          formId: 'nurseryForm',
        }}
        secondaryAction={{ label: 'Cancel', onClick: () => setOpen(false) }}
        footerContent="Actions stay reachable with safe-area padding on mobile."
        side="bottom"
      >
        <form
          id="nurseryForm"
          ref={formRef}
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
              <SelectTrigger
                className={`mt-1 ${fieldErrors.location_id ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
              >
                <SelectValue placeholder="Select a location" />
              </SelectTrigger>
              <SelectContent>
                {locations.map((l) => (
                  <SelectItem key={l.id} value={l.id}>
                    {l.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {fieldErrors.location_id ? (
              <p className="text-destructive text-sm mt-1">{fieldErrors.location_id}</p>
            ) : null}
          </div>
          <div>
            <label className="text-sm font-medium">Notes</label>
            <Textarea
              name="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mt-1"
              rows={3}
            />
          </div>
        </form>
      </InlineCreateSheet>

      <InlineCreateSheet
        open={sowOpen}
        onOpenChange={(next) => {
          setSowOpen(next);
          if (!next) setPendingVarietyId(null);
        }}
        title="Record nursery sow"
        description="Log a sowing in a nursery and attach photos for traceability."
        primaryAction={{ label: 'Save sowing', formId: 'nurserySowForm' }}
        secondaryAction={{ label: 'Cancel', onClick: () => setSowOpen(false) }}
        side="right"
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Prefilled nursery and date based on your selection.
            </p>
            <Button variant="outline" size="sm" onClick={() => setVarietySheetOpen(true)}>
              <Plus className="h-4 w-4 mr-1" aria-hidden />
              Add variety
            </Button>
          </div>
          <NurserySowForm
            key={`${selectedNurseryId ?? 'none'}-${pendingVarietyId ?? 'novar'}`}
            cropVarieties={cropVarietiesState}
            nurseries={nurseryOptions}
            closeDialog={() => setSowOpen(false)}
            formId="nurserySowForm"
            defaultNurseryId={selectedNurseryId}
            defaultDate={defaultSowDate}
            defaultVarietyId={pendingVarietyId}
          />
        </div>
      </InlineCreateSheet>

      <InlineCreateSheet
        open={varietySheetOpen}
        onOpenChange={setVarietySheetOpen}
        title="Add crop variety"
        description="Create a variety inline to keep your nursery flow moving."
        primaryAction={{ label: 'Save variety', formId: 'inlineVarietyForm' }}
        secondaryAction={{ label: 'Cancel', onClick: () => setVarietySheetOpen(false) }}
        side="right"
      >
        <CropVarietyForm
          formId="inlineVarietyForm"
          closeDialog={() => setVarietySheetOpen(false)}
          crops={crops}
          cropVariety={null}
          onCreated={(variety) => {
            setCropVarietiesState((prev) =>
              [...prev, variety].sort((a, b) => a.name.localeCompare(b.name))
            );
            setPendingVarietyId(variety.id);
            setVarietySheetOpen(false);
            setSowOpen(true);
          }}
        />
      </InlineCreateSheet>

      {hasNurseries && isMobile ? (
        <StickyActionBar align="end" aria-label="Quick add nursery" position="fixed">
          <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
            <Button
              onClick={() => handleOpenSow(selectedNurseryId)}
              className="w-full sm:w-auto"
              variant="secondary"
            >
              <Sprout className="h-4 w-4 mr-2" aria-hidden />
              Record sow
            </Button>
            <Button
              onClick={() => {
                setEditing(null);
                setOpen(true);
              }}
              className="w-full sm:w-auto"
            >
              <Plus className="h-4 w-4 mr-2" aria-hidden />
              Add Nursery
            </Button>
          </div>
        </StickyActionBar>
      ) : null}
    </div>
  );
}
