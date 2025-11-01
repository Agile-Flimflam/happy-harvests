'use client';

import { useEffect, useState, useCallback } from 'react';
import type { Tables } from '@/lib/supabase-server';
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import FormDialog from "@/components/dialogs/FormDialog";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { deletePlanting, markPlantingAsPlanted } from '../_actions';
import { NurserySowForm } from './NurserySowForm';
import { DirectSeedForm } from './DirectSeedForm';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Trash2,
  PlusCircle,
  Sprout,
  Leaf,
  ShoppingBasket,
  TrendingUp,
  ArrowRightLeft,
  Shovel,
  Move,
  History,
  RotateCcw
} from 'lucide-react';
import { toast } from "sonner";
import { addDaysUtc, formatDateLocal } from '@/lib/date';
import { positiveOrNull } from '@/lib/utils';
import PageHeader from '@/components/page-header';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import PageContent from '@/components/page-content';
import TransplantForm from './TransplantForm';
import MoveForm from './MoveForm';
import HarvestForm from './HarvestForm';
import RemovePlantingForm from './RemovePlantingForm';
import PlantingHistoryDialog from './PlantingHistoryDialog';
import { PLANTING_STATUS } from '@/lib/plantings/constants';
import StatusBadge from '@/components/plantings/StatusBadge';

type Planting = Tables<'plantings'>;
type CropVariety = Pick<Tables<'crop_varieties'>, 'id' | 'name' | 'latin_name' | 'dtm_direct_seed_min' | 'dtm_direct_seed_max' | 'dtm_transplant_min' | 'dtm_transplant_max'> & { crops?: { name: string } | null };
type Bed = Pick<Tables<'beds'>, 'id' | 'length_inches' | 'width_inches'> & { plots?: { locations: { name: string } | null } | null };

type PlantingWithDetails = Planting & {
  crop_varieties: { name: string; latin_name: string; dtm_direct_seed_min?: number | null; dtm_direct_seed_max?: number | null; dtm_transplant_min?: number | null; dtm_transplant_max?: number | null; crops: { name: string } | null } | null;
  beds: { id: number; length_inches: number | null; width_inches: number | null; plots: { locations: { name: string } | null } | null } | null;
  nurseries: { name: string } | null;
  planted_qty?: number | null;
  planted_weight_grams?: number | null;
  harvest_qty?: number | null;
  harvest_weight_grams?: number | null;
};

interface PlantingsPageContentProps {
  plantings: PlantingWithDetails[];
  cropVarieties: CropVariety[];
  beds: Bed[];
  nurseries: { id: string; name: string }[];
  scheduleDate?: string;
  defaultCreateMode?: 'nursery' | 'direct' | null;
}

export function PlantingsPageContent({ plantings, cropVarieties, beds, nurseries: _nurseries, scheduleDate, defaultCreateMode = null }: PlantingsPageContentProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [createMode, setCreateMode] = useState<'nursery' | 'direct' | null>(defaultCreateMode);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'nursery' | 'planted' | 'harvested'>('active');
  const [actionDialog, setActionDialog] = useState<
    | { type: 'transplant' | 'move' | 'remove' | 'history'; plantingId: number }
    | { type: 'harvest'; plantingId: number; defaultQty?: number | null; defaultWeight?: number | null }
    | null
  >(null);

  // Optimistic projections immediately after transplant
  const [optimisticHarvest, setOptimisticHarvest] = useState<Record<number, { start: string; end: string }>>({});

  const selectNormalizedRange = useCallback((
    primaryMin?: number | null,
    primaryMax?: number | null,
    secondaryMin?: number | null,
    secondaryMax?: number | null,
  ): { min: number | null; max: number | null } => {
    const pMin = positiveOrNull(primaryMin);
    const pMax = positiveOrNull(primaryMax);
    const sMin = positiveOrNull(secondaryMin);
    const sMax = positiveOrNull(secondaryMax);

    const minCandidate = pMin ?? pMax ?? sMin ?? sMax ?? null;
    const maxCandidate = pMax ?? pMin ?? sMax ?? sMin ?? null;
    if (minCandidate == null || maxCandidate == null) return { min: null, max: null };

    let minDays = minCandidate;
    let maxDays = maxCandidate;
    if (minDays > maxDays) {
      [minDays, maxDays] = [maxDays, minDays];
    }
    return { min: minDays, max: maxDays };
  }, []);

  useEffect(() => {
    const handler = (e: Event) => {
      const ce = e as CustomEvent<{ plantingId: number; eventDate: string }>;
      const detail = ce.detail;
      if (!detail) return;
      const planting = plantings.find((x) => x.id === detail.plantingId);
      const cv = planting?.crop_varieties ?? cropVarieties.find((v) => v.id === planting?.crop_variety_id);
      if (!planting || !cv) return;
      const { min, max } = selectNormalizedRange(
        cv.dtm_transplant_min,
        cv.dtm_transplant_max,
        cv.dtm_direct_seed_min,
        cv.dtm_direct_seed_max,
      );
      if (min == null || max == null) return;
      setOptimisticHarvest((prev) => ({ ...prev, [detail.plantingId]: { start: addDaysUtc(detail.eventDate, min), end: addDaysUtc(detail.eventDate, max) } }));
    };
    window.addEventListener('planting:transplanted', handler as EventListener);
    return () => window.removeEventListener('planting:transplanted', handler as EventListener);
  }, [plantings, cropVarieties, selectNormalizedRange]);

  const openNurserySow = () => { setCreateMode('nursery'); setIsDialogOpen(true); };
  const openDirectSeed = () => { setCreateMode('direct'); setIsDialogOpen(true); };
  const closeDialog = () => {
    setIsDialogOpen(false);
    setCreateMode(null);
  };
  const closeActionDialog = () => setActionDialog(null);

  // Allow removal even if mistakenly marked as harvested; only block when already removed
  const canBeRemoved = (status: (typeof PLANTING_STATUS)[keyof typeof PLANTING_STATUS]) =>
    status !== PLANTING_STATUS.removed;

  const openDelete = (id: number) => setDeleteId(id);
  const confirmDelete = async () => {
    if (deleteId == null) return;
    try {
      setDeleting(true);
      const result = await deletePlanting(deleteId);
      if (result.message.startsWith('Database Error:') || result.message.startsWith('Error:')) {
        toast.error(result.message);
      } else {
        toast.success(result.message);
      }
    } finally {
      setDeleting(false);
      setDeleteId(null);
    }
  };

  // Hide removed plantings from default view and stats
  const visiblePlantings = plantings.filter((p) => p.status !== PLANTING_STATUS.removed);

  const getStatusStats = () => {
    const nurseryCount = visiblePlantings.filter(p => p.status === PLANTING_STATUS.nursery).length;
    const plantedCount = visiblePlantings.filter(p => p.status === PLANTING_STATUS.planted).length;
    const harvestedCount = visiblePlantings.filter(p => p.status === PLANTING_STATUS.harvested).length;

    return {
      total: visiblePlantings.length,
      nursery: nurseryCount,
      planted: plantedCount,
      harvested: harvestedCount
    };
  };

  const stats = getStatusStats();

  const computeProjectedHarvestWindow = useCallback((p: PlantingWithDetails): { start: string | null; end: string | null; awaitingTransplant: boolean } => {
    // If we have an optimistic projection (immediately after transplant), use it first
    const opt = optimisticHarvest[p.id];
    if (opt) return { start: opt.start, end: opt.end, awaitingTransplant: false };

    // Prefer joined variety DTM; fallback to varieties list by crop_variety_id
    const joined = p.crop_varieties;
    const fallback = cropVarieties.find((v) => v.id === p.crop_variety_id);

    const isTransplantPath = Boolean(p.nursery_started_date);
    if (isTransplantPath) {
      if (p.planted_date) {
        const base = p.planted_date;
        const { min, max } = selectNormalizedRange(
          joined?.dtm_transplant_min ?? fallback?.dtm_transplant_min,
          joined?.dtm_transplant_max ?? fallback?.dtm_transplant_max,
          joined?.dtm_direct_seed_min ?? fallback?.dtm_direct_seed_min,
          joined?.dtm_direct_seed_max ?? fallback?.dtm_direct_seed_max,
        );
        if (min != null && max != null) {
          return { start: addDaysUtc(base, min), end: addDaysUtc(base, max), awaitingTransplant: false };
        }
        return { start: null, end: null, awaitingTransplant: false };
      }
      // Not yet transplanted → we cannot project exact dates without a target nursery duration
      return { start: null, end: null, awaitingTransplant: true };
    }
    // Direct seed path
    const base = p.planted_date ?? null;
    const { min, max } = selectNormalizedRange(
      joined?.dtm_direct_seed_min ?? fallback?.dtm_direct_seed_min,
      joined?.dtm_direct_seed_max ?? fallback?.dtm_direct_seed_max,
      undefined,
      undefined,
    );
    if (base && min != null && max != null) {
      return { start: addDaysUtc(base, min), end: addDaysUtc(base, max), awaitingTransplant: false };
    }
    return { start: null, end: null, awaitingTransplant: false };
  }, [optimisticHarvest, cropVarieties, selectNormalizedRange]);

  const filteredPlantings = (() => {
    switch (statusFilter) {
      case 'all':
        return visiblePlantings;
      case 'active':
        return visiblePlantings.filter((p) => p.status === PLANTING_STATUS.nursery || p.status === PLANTING_STATUS.planted);
      case 'nursery':
        return visiblePlantings.filter((p) => p.status === PLANTING_STATUS.nursery);
      case 'planted':
        return visiblePlantings.filter((p) => p.status === PLANTING_STATUS.planted);
      case 'harvested':
        return visiblePlantings.filter((p) => p.status === PLANTING_STATUS.harvested);
      default:
        return visiblePlantings;
    }
  })();

  const hasPlantings = visiblePlantings.length > 0;

  return (
    <div>
      <PageHeader
        title="Plantings"
        action={hasPlantings ? (
          <Button
            size="sm"
            className="w-full sm:w-auto"
            onClick={() => { setCreateMode('nursery'); setIsDialogOpen(true); }}
          >
            <PlusCircle className="h-4 w-4 mr-2" />
            Add Planting
          </Button>
        ) : undefined}
      />

      <FormDialog
        open={isDialogOpen}
        onOpenChange={(open) => { setIsDialogOpen(open); if (!open) setCreateMode(null) }}
        title={createMode === 'direct' ? 'Direct seed' : 'Nursery sow'}
        description={createMode === 'direct' ? 'Seed directly in field' : 'Start in nursery'}
        submitLabel={createMode === 'direct' ? 'Create Direct Seed Planting' : 'Create Nursery Planting'}
        formId={createMode === 'direct' ? 'directSeedForm' : 'nurserySowForm'}
        className="sm:max-w-md"
      >
        <Tabs value={createMode ?? 'nursery'} onValueChange={(v) => setCreateMode(v as 'nursery' | 'direct')}>
          <TabsList>
            <TabsTrigger value="nursery">Nursery Sow</TabsTrigger>
            <TabsTrigger value="direct">Direct Seed</TabsTrigger>
          </TabsList>
          <TabsContent value="nursery">
            <NurserySowForm cropVarieties={cropVarieties} nurseries={_nurseries} closeDialog={closeDialog} formId="nurserySowForm" defaultDate={scheduleDate} />
          </TabsContent>
          <TabsContent value="direct">
            <DirectSeedForm cropVarieties={cropVarieties} beds={beds} closeDialog={closeDialog} formId="directSeedForm" defaultDate={scheduleDate} />
          </TabsContent>
        </Tabs>
      </FormDialog>

      {actionDialog && (
        <FormDialog
          open={actionDialog != null}
          onOpenChange={(open) => { if (!open) closeActionDialog(); }}
          title={
            actionDialog.type === 'transplant' ? 'Transplant' :
            actionDialog.type === 'move' ? 'Move Planting' :
            actionDialog.type === 'harvest' ? 'Harvest' :
            actionDialog.type === 'history' ? 'Planting History' :
            'Remove Planting'
          }
          description={
            actionDialog.type === 'transplant' ? 'Move from nursery to field bed' :
            actionDialog.type === 'move' ? 'Move between beds' :
            actionDialog.type === 'harvest' ? 'Enter final harvest metrics' :
            actionDialog.type === 'history' ? 'Event timeline and table' :
            'Remove this planting (no harvest)'
          }
          submitLabel={
            actionDialog.type === 'transplant' ? 'Transplant' :
            actionDialog.type === 'move' ? 'Move' :
            actionDialog.type === 'harvest' ? 'Harvest' :
            actionDialog.type === 'history' ? undefined :
            'Remove Planting'
          }
          formId={
            actionDialog.type === 'transplant' ? 'transplantForm' :
            actionDialog.type === 'move' ? 'moveForm' :
            actionDialog.type === 'harvest' ? 'harvestForm' :
            actionDialog.type === 'history' ? undefined :
            'removeForm'
          }
          className={actionDialog.type === 'history' ? 'sm:max-w-2xl' : 'sm:max-w-md'}
        >
          {actionDialog.type === 'transplant' && (
            <TransplantForm plantingId={actionDialog.plantingId} beds={beds} closeDialog={closeActionDialog} formId="transplantForm" />
          )}
          {actionDialog.type === 'move' && (
            <MoveForm plantingId={actionDialog.plantingId} beds={beds} closeDialog={closeActionDialog} formId="moveForm" />
          )}
          {actionDialog && actionDialog.type === 'harvest' && (
            <HarvestForm plantingId={actionDialog.plantingId} closeDialog={closeActionDialog} formId="harvestForm" defaultQty={actionDialog.defaultQty ?? undefined} defaultWeight={actionDialog.defaultWeight ?? undefined} />
          )}
          {actionDialog.type === 'history' && (
            <PlantingHistoryDialog
              plantingId={actionDialog.plantingId}
              varietyName={plantings.find((x) => x.id === actionDialog.plantingId)?.crop_varieties?.name}
              cropName={plantings.find((x) => x.id === actionDialog.plantingId)?.crop_varieties?.crops?.name ?? null}
              status={plantings.find((x) => x.id === actionDialog.plantingId)?.status ?? null}
            />
          )}
          {actionDialog.type === 'remove' && (
            <RemovePlantingForm plantingId={actionDialog.plantingId} closeDialog={closeActionDialog} formId="removeForm" />
          )}
        </FormDialog>
      )}

      <ConfirmDialog
        open={deleteId != null}
        onOpenChange={(open) => { if (!open) setDeleteId(null); }}
        title="Delete planting?"
        description="This action cannot be undone."
        confirmText="Delete"
        confirmVariant="destructive"
        confirming={deleting}
        onConfirm={confirmDelete}
      />

      <PageContent>
        {!hasPlantings ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Sprout className="size-10" />
              </EmptyMedia>
              <EmptyTitle>No plantings yet</EmptyTitle>
              <EmptyDescription>
                Add your first planting to get started.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="lg">
                    <PlusCircle className="h-5 w-5 mr-2" />
                    Add Your First Planting
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="center">
                  <DropdownMenuItem onClick={openNurserySow}>Nursery sow</DropdownMenuItem>
                  <DropdownMenuItem onClick={openDirectSeed}>Direct seed</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </EmptyContent>
          </Empty>
        ) : (
          <div className="space-y-6">
            <div className="flex sm:justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setStatusFilter('active')}
                aria-label="Reset filter to default view"
                className="w-full sm:w-auto"
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Default view
              </Button>
            </div>
            {/* Summary Stats */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Card
                className={`p-4 cursor-pointer transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring ${statusFilter === 'nursery' ? 'ring-2 ring-inset ring-blue-500' : 'hover:shadow-sm'}`}
                role="button"
                tabIndex={0}
                onClick={() => setStatusFilter('nursery')}
                aria-pressed={statusFilter === 'nursery'}
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950">
                    <Leaf className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats.nursery}</p>
                    <p className="text-sm text-muted-foreground">In Nursery</p>
                  </div>
                </div>
              </Card>
              <Card
                className={`p-4 cursor-pointer transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring ${statusFilter === 'planted' ? 'ring-2 ring-inset ring-green-500' : 'hover:shadow-sm'}`}
                role="button"
                tabIndex={0}
                onClick={() => setStatusFilter('planted')}
                aria-pressed={statusFilter === 'planted'}
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-green-50 dark:bg-green-950">
                    <Sprout className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats.planted}</p>
                    <p className="text-sm text-muted-foreground">Planted</p>
                  </div>
                </div>
              </Card>
              <Card
                className={`p-4 cursor-pointer transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring ${statusFilter === 'harvested' ? 'ring-2 ring-inset ring-orange-500' : 'hover:shadow-sm'}`}
                role="button"
                tabIndex={0}
                onClick={() => setStatusFilter('harvested')}
                aria-pressed={statusFilter === 'harvested'}
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-orange-50 dark:bg-orange-950">
                    <ShoppingBasket className="h-5 w-5 text-orange-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats.harvested}</p>
                    <p className="text-sm text-muted-foreground">Harvested</p>
                  </div>
                </div>
              </Card>
              <Card
                className={`p-4 cursor-pointer transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring ${statusFilter === 'all' ? 'ring-2 ring-inset ring-gray-400' : 'hover:shadow-sm'}`}
                role="button"
                tabIndex={0}
                onClick={() => setStatusFilter('all')}
                aria-pressed={statusFilter === 'all'}
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-gray-50 dark:bg-gray-950">
                    <TrendingUp className="h-5 w-5 text-gray-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats.total}</p>
                    <p className="text-sm text-muted-foreground">All</p>
                  </div>
                </div>
              </Card>
            </div>

            {/* Mobile List */}
            <div className="sm:hidden space-y-3">
              {filteredPlantings.map((p) => (
                <Card key={p.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{p.crop_varieties?.name ?? 'N/A'}</p>
                      <p className="text-sm text-muted-foreground">{p.crop_varieties?.crops?.name ?? 'N/A'}</p>
                    </div>
                    <div>
                      {p.status ? <StatusBadge status={p.status} /> : <Badge variant="secondary">Unknown</Badge>}
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs text-muted-foreground">Location</p>
                      <p className="text-sm">
                        {p.status === PLANTING_STATUS.nursery
                          ? (p.nurseries?.name ?? 'Nursery')
                          : (
                              <span>Bed #{p.beds?.id} @ {p.beds?.plots?.locations?.name ?? 'N/A'}</span>
                            )}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Type</p>
                      <p className="text-sm">{p.nursery_started_date ? 'Transplant' : 'Direct Seed'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Qty</p>
                      <p className="text-sm">{p.status === PLANTING_STATUS.harvested ? (p.harvest_qty ?? '-') : (p.planted_qty ?? '-')}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Planted</p>
                      <p className="text-sm">{p.planted_date ?? '-'}</p>
                    </div>
                  </div>
                  {/* Projected harvest window */}
                  <div className="mt-3">
                    {(() => {
                      const proj = computeProjectedHarvestWindow(p);
                      return (
                        <p className="text-xs text-muted-foreground">
                          {proj.start && proj.end ? (
                            <>Projected harvest: <span className="text-foreground font-medium">{`${formatDateLocal(proj.start)} – ${formatDateLocal(proj.end)}`}</span></>
                          ) : proj.awaitingTransplant ? (
                            'Projected harvest shown after transplant'
                          ) : (
                            'Projected harvest unavailable'
                          )}
                        </p>
                      );
                    })()}
                  </div>
                  <div className="mt-3 flex items-center justify-end gap-2">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="mr-2">
                          <ArrowRightLeft className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {p.status === PLANTING_STATUS.nursery && (
                          <>
                            <DropdownMenuItem onClick={() => setActionDialog({ type: 'transplant', plantingId: p.id })}>
                              <Sprout className="mr-2 h-4 w-4" />
                              Transplant
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                          </>
                        )}
                        {(p.status === PLANTING_STATUS.planted || p.status === PLANTING_STATUS.harvested) && (
                          <>
                            {!p.nursery_started_date ? (
                              <>
                                <DropdownMenuItem onClick={() => setActionDialog({ type: 'harvest', plantingId: p.id })}>
                                  <ShoppingBasket className="mr-2 h-4 w-4" />
                                  Harvest
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setActionDialog({ type: 'move', plantingId: p.id })}>
                                  <Move className="mr-2 h-4 w-4" />
                                  Move
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                              </>
                            ) : (
                              <>
                                <DropdownMenuItem onClick={() => setActionDialog({ type: 'move', plantingId: p.id })}>
                                  <Move className="mr-2 h-4 w-4" />
                                  Move
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => setActionDialog({ type: 'harvest', plantingId: p.id })}>
                                  <ShoppingBasket className="mr-2 h-4 w-4" />
                                  Harvest
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                              </>
                            )}
                            {p.status === PLANTING_STATUS.harvested && (
                              <>
                                <DropdownMenuItem onClick={async () => {
                                  const fd = new FormData();
                                  fd.append('planting_id', String(p.id));
                                  const result = await markPlantingAsPlanted(fd);
                                  if ('ok' in result && result.ok === true) {
                                    toast.success('Status changed to Planted');
                                  } else if ('error' in result) {
                                    toast.error(result.error);
                                  } else {
                                    toast.error('Unknown error updating status.');
                                  }
                                }}>
                                  <Sprout className="mr-2 h-4 w-4" />
                                  Mark as Planted
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                              </>
                            )}
                          </>
                        )}
                        {canBeRemoved(p.status) && (
                          <DropdownMenuItem onClick={() => setActionDialog({ type: 'remove', plantingId: p.id })}>
                            <Shovel className="mr-2 h-4 w-4" />
                            Remove
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>

                    <Button variant="ghost" size="icon" onClick={() => setActionDialog({ type: 'history', plantingId: p.id })} className="mr-2">
                      <History className="h-4 w-4" />
                    </Button>

                    <Button variant="ghost" size="icon" onClick={() => openDelete(p.id)} className="text-red-500 hover:text-red-700">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </Card>
              ))}
            </div>

            {/* Plantings Table */}
            <div className="hidden sm:block border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Variety</TableHead>
                    <TableHead>Crop</TableHead>
                    <TableHead>Bed</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Qty</TableHead>
                    <TableHead>Planted</TableHead>
                    <TableHead>Harvest Window</TableHead>
                    <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPlantings.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.crop_varieties?.name ?? 'N/A'}</TableCell>
                      <TableCell>{p.crop_varieties?.crops?.name ?? 'N/A'}</TableCell>
                      <TableCell>
                        {p.status === PLANTING_STATUS.nursery
                          ? (p.nurseries?.name ?? 'Nursery')
                          : (
                            <span>Bed #{p.beds?.id} @ {p.beds?.plots?.locations?.name ?? 'N/A'}</span>
                          )}
                      </TableCell>
                      <TableCell>{p.nursery_started_date ? 'Transplant' : 'Direct Seed'}</TableCell>
                      <TableCell>{p.status === PLANTING_STATUS.harvested ? (p.harvest_qty ?? '-') : (p.planted_qty ?? '-')}</TableCell>
                      <TableCell>{p.planted_date ?? '-'}</TableCell>
                      <TableCell>
                        {(() => {
                          const proj = computeProjectedHarvestWindow(p);
                          return (
                            <span className="whitespace-nowrap">
                              {proj.start && proj.end
                                ? `${formatDateLocal(proj.start)} – ${formatDateLocal(proj.end)}`
                                : (proj.awaitingTransplant ? 'Shown after transplant' : 'Projected harvest unavailable')}
                            </span>
                          );
                        })()}
                      </TableCell>
                      <TableCell>
                        {p.status ? <StatusBadge status={p.status} /> : <Badge variant="secondary">Unknown</Badge>}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="mr-2">
                              <ArrowRightLeft className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {p.status === PLANTING_STATUS.nursery && (
                              <>
                                <DropdownMenuItem onClick={() => setActionDialog({ type: 'transplant', plantingId: p.id })}>
                                  <Sprout className="mr-2 h-4 w-4" />
                                  Transplant
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                              </>
                            )}
                            {(p.status === PLANTING_STATUS.planted || p.status === PLANTING_STATUS.harvested) && (
                              <>
                                {!p.nursery_started_date ? (
                                  <>
                                    <DropdownMenuItem onClick={() => setActionDialog({ type: 'harvest', plantingId: p.id })}>
                                      <ShoppingBasket className="mr-2 h-4 w-4" />
                                      Harvest
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => setActionDialog({ type: 'move', plantingId: p.id })}>
                                      <Move className="mr-2 h-4 w-4" />
                                      Move
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                  </>
                                ) : (
                                  <>
                                    <DropdownMenuItem onClick={() => setActionDialog({ type: 'move', plantingId: p.id })}>
                                      <Move className="mr-2 h-4 w-4" />
                                      Move
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={() => setActionDialog({ type: 'harvest', plantingId: p.id })}>
                                      <ShoppingBasket className="mr-2 h-4 w-4" />
                                      Harvest
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                  </>
                                )}
                                {p.status === PLANTING_STATUS.harvested && (
                                  <>
                                    <DropdownMenuItem onClick={async () => {
                                      const fd = new FormData();
                                      fd.append('planting_id', String(p.id));
                                      const result = await markPlantingAsPlanted(fd);
                                      if ('ok' in result && result.ok === true) {
                                        toast.success('Status changed to Planted');
                                      } else if ('error' in result) {
                                        toast.error(result.error);
                                      } else {
                                        toast.error('Unknown error updating status.');
                                      }
                                    }}>
                                      <Sprout className="mr-2 h-4 w-4" />
                                      Mark as Planted
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                  </>
                                )}
                              </>
                            )}
                            {canBeRemoved(p.status) && (
                              <DropdownMenuItem onClick={() => setActionDialog({ type: 'remove', plantingId: p.id })}>
                                <Shovel className="mr-2 h-4 w-4" />
                                Remove
                              </DropdownMenuItem>
                            )}
                            
                          </DropdownMenuContent>
                        </DropdownMenu>

                        <Button variant="ghost" size="icon" onClick={() => setActionDialog({ type: 'history', plantingId: p.id })} className="mr-2">
                          <History className="h-4 w-4" />
                        </Button>

                        <Button variant="ghost" size="icon" onClick={() => openDelete(p.id)} className="text-red-500 hover:text-red-700">
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
      </PageContent>
    </div>
  );
}
