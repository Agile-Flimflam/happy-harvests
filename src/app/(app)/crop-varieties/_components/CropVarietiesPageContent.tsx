'use client';

import { useActionState, useEffect, useMemo, useState, useTransition } from 'react';
import type { Tables } from '@/lib/supabase-server';
import { Button } from '@/components/ui/button';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { CropVarietyForm } from '../_components/CropVarietyForm';
import {
  deleteCropVariety,
  type DeleteCropVarietyResult,
  createCropSimple,
  toggleFavoriteCrop,
} from '../_actions';
import { Pencil, Trash2, Plus, Leaf, Star, StarOff } from 'lucide-react';
import Image from 'next/image';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { FlowShell } from '@/components/ui/flow-shell';
import { InlineCreateSheet } from '@/components/ui/inline-create-sheet';
import { StickyActionBar } from '@/components/ui/sticky-action-bar';
import { useIsMobile } from '@/hooks/use-mobile';
import { RecentChips } from '@/components/ui/recent-chips';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Constants } from '@/lib/database.types';
import type { CropVarietyPrefs } from '@/lib/crop-variety-prefs';

type CropVariety = Tables<'crop_varieties'> & { crops?: { name: string } | null } & {
  image_url: string | null;
};

type CropLite = Pick<Tables<'crops'>, 'id' | 'name' | 'crop_type' | 'created_at'>;

function isCropLite(value: unknown): value is CropLite {
  if (value == null || typeof value !== 'object') return false;
  const candidate = value as Partial<CropLite>;
  return (
    typeof candidate.id === 'number' &&
    Number.isFinite(candidate.id) &&
    typeof candidate.name === 'string' &&
    candidate.name.trim().length > 0 &&
    typeof candidate.crop_type === 'string' &&
    candidate.crop_type.trim().length > 0 &&
    typeof candidate.created_at === 'string'
  );
}

interface CropVarietiesPageContentProps {
  cropVarieties: CropVariety[];
  crops?: CropLite[];
  prefs?: CropVarietyPrefs | null;
}

export function CropVarietiesPageContent({
  cropVarieties,
  crops = [],
  prefs = null,
}: CropVarietiesPageContentProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCropVariety, setEditingCropVariety] = useState<CropVariety | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);
  const hasVarieties = cropVarieties.length > 0;
  const isMobile = useIsMobile();
  const [cropsState, setCropsState] = useState<CropLite[]>(crops);
  const [favoriteCropIds, setFavoriteCropIds] = useState<number[]>(prefs?.favoriteCropIds ?? []);
  const [recentCropIds] = useState<number[]>(prefs?.recentCropIds ?? []);
  const [activeCropId, setActiveCropId] = useState<number | null>(
    prefs?.lastDefaults?.cropId ??
      prefs?.favoriteCropIds?.find((id) => crops.some((c) => c.id === id)) ??
      prefs?.recentCropIds?.find((id) => crops.some((c) => c.id === id)) ??
      crops[0]?.id ??
      null
  );
  const [isCropSheetOpen, setIsCropSheetOpen] = useState(false);
  const [pendingFavoriteId, setPendingFavoriteId] = useState<number | null>(null);
  const [cropFormState, cropFormAction, isSubmittingCrop] = useActionState(createCropSimple, {
    message: '',
    errors: {},
    crop: null,
  });
  const [isTogglingFavorite, startToggleFavorite] = useTransition();
  const [newCropType, setNewCropType] = useState<string>('');
  const cropMap = useMemo(() => {
    const map = new Map<number, CropLite>();
    cropsState.forEach((crop) => map.set(crop.id, crop));
    return map;
  }, [cropsState]);
  const favoriteCrops = useMemo(
    () => favoriteCropIds.map((id) => cropMap.get(id)).filter(Boolean) as CropLite[],
    [cropMap, favoriteCropIds]
  );
  const recentCrops = useMemo(
    () => recentCropIds.map((id) => cropMap.get(id)).filter(Boolean) as CropLite[],
    [cropMap, recentCropIds]
  );
  const quickLinkCrops = useMemo(() => {
    const ordered = [...favoriteCrops, ...recentCrops, ...cropsState];
    const seen = new Set<number>();
    const unique: CropLite[] = [];
    ordered.forEach((crop) => {
      if (seen.has(crop.id)) return;
      seen.add(crop.id);
      unique.push(crop);
    });
    return unique.slice(0, 6);
  }, [cropsState, favoriteCrops, recentCrops]);
  const defaultIsOrganic = prefs?.lastDefaults?.isOrganic ?? false;
  const chipItems = useMemo(() => {
    const seen = new Set<number>();
    return [...favoriteCrops, ...recentCrops]
      .filter((crop) => {
        if (seen.has(crop.id)) return false;
        seen.add(crop.id);
        return true;
      })
      .map((crop) => ({
        label: favoriteCropIds.includes(crop.id) ? `${crop.name} ★` : crop.name,
        value: crop.id.toString(),
      }));
  }, [favoriteCrops, favoriteCropIds, recentCrops]);

  useEffect(() => {
    if (!cropFormState.message) return;
    if (cropFormState.errors && Object.keys(cropFormState.errors).length > 0) {
      toast.error(cropFormState.message);
      return;
    }
    if (cropFormState.crop) {
      if (!isCropLite(cropFormState.crop)) {
        console.error('Invalid crop payload received:', cropFormState.crop);
        toast.error('Received invalid crop data. Please refresh and try again.');
        return;
      }
      const created = cropFormState.crop;
      setCropsState((prev) =>
        [...prev, created].sort((a, b) =>
          a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
        )
      );
      setActiveCropId(created.id);
      setNewCropType('');
      toast.success(cropFormState.message);
      setIsCropSheetOpen(false);
    }
  }, [cropFormState]);

  const handleEdit = (cropVariety: CropVariety) => {
    setEditingCropVariety(cropVariety);
    setActiveCropId(cropVariety.crop_id ?? activeCropId ?? null);
    setIsDialogOpen(true);
  };

  const handleAdd = (cropId?: number | null) => {
    if (cropId) {
      setActiveCropId(cropId);
    }
    setEditingCropVariety(null);
    setIsDialogOpen(true);
  };

  const openDelete = (id: number) => setDeleteId(id);
  const confirmDelete = async () => {
    if (deleteId == null) return;
    try {
      setDeleting(true);
      const result: DeleteCropVarietyResult = await deleteCropVariety(deleteId);
      if (result.message.startsWith('Database Error:')) {
        toast.error(result.message);
      } else {
        toast.success(result.message);
      }
    } catch (error) {
      console.error('Delete Error:', error);
      toast.error('An unexpected error occurred while deleting the crop variety.');
    } finally {
      setDeleting(false);
      setDeleteId(null);
    }
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    setEditingCropVariety(null);
  };

  const handleToggleFavorite = (cropId: number) => {
    setPendingFavoriteId(cropId);
    startToggleFavorite(async () => {
      const prefsUpdated = await toggleFavoriteCrop(cropId);
      setPendingFavoriteId(null);
      if (!prefsUpdated) {
        toast.error('Unable to update favorites right now.');
        return;
      }
      setFavoriteCropIds(prefsUpdated.favoriteCropIds ?? []);
    });
  };

  const formId = 'crop-variety-form';

  return (
    <div>
      <FlowShell
        title="Crop Varieties"
        description="Manage varieties with images, DTM, and organic status."
        icon={<Leaf className="h-5 w-5" aria-hidden />}
        actions={
          !isMobile ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setIsCropSheetOpen(true)}>
                <Plus className="h-4 w-4 mr-2" aria-hidden />
                Add Crop
              </Button>
              <Button
                onClick={() => handleAdd(activeCropId)}
                size="sm"
                className="w-full sm:w-auto"
              >
                <Plus className="h-4 w-4 mr-2" aria-hidden />
                Add Crop Variety
              </Button>
            </div>
          ) : undefined
        }
      >
        <div className="mb-4 space-y-3">
          {quickLinkCrops.length > 0 ? (
            <div className="rounded-lg border bg-muted/40 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <Leaf className="h-4 w-4" aria-hidden />
                  <span>Start from a crop</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-2"
                  onClick={() => setIsCropSheetOpen(true)}
                >
                  <Plus className="h-4 w-4" aria-hidden />
                  Add crop
                </Button>
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {quickLinkCrops.map((crop) => {
                  const isFavorite = favoriteCropIds.includes(crop.id);
                  const isActive = activeCropId === crop.id;
                  const isBusy = pendingFavoriteId === crop.id && isTogglingFavorite;
                  return (
                    <div
                      key={crop.id}
                      className="flex items-center justify-between rounded-md border bg-background px-3 py-2"
                    >
                      <button
                        type="button"
                        className={`flex flex-col items-start text-left ${isActive ? 'text-primary' : ''}`}
                        onClick={() => {
                          setActiveCropId(crop.id);
                          handleAdd(crop.id);
                        }}
                      >
                        <span className="text-sm font-medium">{crop.name}</span>
                        <span className="text-xs text-muted-foreground">{crop.crop_type}</span>
                      </button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={isFavorite ? 'Unfavorite crop' : 'Favorite crop'}
                        disabled={isBusy}
                        onClick={() => handleToggleFavorite(crop.id)}
                      >
                        {isFavorite ? (
                          <Star className="h-4 w-4 fill-yellow-400 text-yellow-500" aria-hidden />
                        ) : (
                          <StarOff className="h-4 w-4" aria-hidden />
                        )}
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}
          {chipItems.length > 0 ? (
            <RecentChips
              items={chipItems}
              activeValue={activeCropId ? activeCropId.toString() : null}
              onSelect={(value) => {
                setActiveCropId(value ? Number(value) : null);
              }}
              ariaLabel="Pick a crop to prefill variety"
              clearLabel="Clear crop selection"
            />
          ) : null}
        </div>
        {!hasVarieties ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Leaf className="size-10" />
              </EmptyMedia>
              <EmptyTitle>No crop varieties yet</EmptyTitle>
              <EmptyDescription>
                Add a crop variety to start planning and tracking your crops.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button onClick={() => handleAdd(activeCropId)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Crop Variety
              </Button>
            </EmptyContent>
          </Empty>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Image</TableHead>
                  <TableHead>Crop</TableHead>
                  <TableHead>Variety</TableHead>
                  <TableHead>Latin Name</TableHead>
                  <TableHead>Organic</TableHead>
                  <TableHead>DTM (DS)</TableHead>
                  <TableHead>DTM (TP)</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cropVarieties.map((cropVariety) => (
                  <TableRow key={cropVariety.id}>
                    <TableCell>
                      {cropVariety.image_url ? (
                        <Image
                          src={cropVariety.image_url}
                          alt={`${cropVariety.name} variety image`}
                          width={40}
                          height={40}
                          className="h-10 w-10 rounded object-cover border"
                        />
                      ) : (
                        <div className="h-10 w-10 rounded border bg-muted" />
                      )}
                    </TableCell>
                    <TableCell className="font-medium">
                      {cropVariety.crops?.name ?? 'N/A'}
                    </TableCell>
                    <TableCell>{cropVariety.name}</TableCell>
                    <TableCell className="font-serif italic text-muted-foreground text-sm whitespace-nowrap">
                      {cropVariety.latin_name ?? 'N/A'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={cropVariety.is_organic ? 'secondary' : 'outline'}>
                        {cropVariety.is_organic ? 'Yes' : 'No'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {cropVariety.dtm_direct_seed_min != null &&
                      cropVariety.dtm_direct_seed_max != null
                        ? `${cropVariety.dtm_direct_seed_min}-${cropVariety.dtm_direct_seed_max}`
                        : 'N/A'}
                    </TableCell>
                    <TableCell>
                      {cropVariety.dtm_transplant_min != null &&
                      cropVariety.dtm_transplant_max != null
                        ? `${cropVariety.dtm_transplant_min}-${cropVariety.dtm_transplant_max}`
                        : 'N/A'}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(cropVariety)}
                        className="mr-2"
                        aria-label={`Edit ${cropVariety.name}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openDelete(cropVariety.id)}
                        className="text-red-500 hover:text-red-700"
                        aria-label={`Delete ${cropVariety.name}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <ConfirmDialog
              open={deleteId != null}
              onOpenChange={(open) => {
                if (!open) setDeleteId(null);
              }}
              title="Delete crop variety?"
              description="Deletion will fail if the variety is linked to existing crops."
              confirmText="Delete"
              confirmVariant="destructive"
              confirming={deleting}
              onConfirm={confirmDelete}
            />
          </div>
        )}
      </FlowShell>

      <InlineCreateSheet
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        title={editingCropVariety ? 'Edit Crop Variety' : 'Add New Crop Variety'}
        description={
          editingCropVariety
            ? 'Make changes to the crop variety details.'
            : 'Enter the details for the new crop variety.'
        }
        primaryAction={{
          label: editingCropVariety ? 'Update Crop Variety' : 'Create Crop Variety',
          formId: formId,
        }}
        secondaryAction={{ label: 'Cancel', onClick: closeDialog }}
        footerContent="Sheet actions stay reachable on mobile."
        side="bottom"
      >
        <CropVarietyForm
          formId={formId}
          cropVariety={editingCropVariety}
          crops={cropsState}
          closeDialog={closeDialog}
          defaultCropId={activeCropId}
          defaultIsOrganic={defaultIsOrganic}
        />
      </InlineCreateSheet>

      <InlineCreateSheet
        open={isCropSheetOpen}
        onOpenChange={setIsCropSheetOpen}
        title="Add crop"
        description="Create a parent crop before adding varieties."
        primaryAction={{ label: 'Save crop', formId: 'quickCropForm' }}
        secondaryAction={{ label: 'Cancel', onClick: () => setIsCropSheetOpen(false) }}
      >
        <form id="quickCropForm" className="space-y-3" action={cropFormAction}>
          <div className="space-y-1.5">
            <Label htmlFor="cropName">Name</Label>
            <Input
              id="cropName"
              name="name"
              placeholder="Lettuce"
              required
              aria-describedby="cropNameError"
            />
            {cropFormState.errors?.name ? (
              <p id="cropNameError" className="text-sm text-destructive">
                {cropFormState.errors.name[0]}
              </p>
            ) : null}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cropType">Type</Label>
            <Select value={newCropType} onValueChange={setNewCropType}>
              <SelectTrigger id="cropType">
                <SelectValue placeholder="Select crop type" />
              </SelectTrigger>
              <SelectContent>
                {(Constants.public.Enums.crop_type as readonly string[])
                  .slice()
                  .sort((a, b) => a.localeCompare(b))
                  .map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            <input type="hidden" name="crop_type" value={newCropType} />
            {cropFormState.errors?.crop_type ? (
              <p className="text-sm text-destructive">{cropFormState.errors.crop_type[0]}</p>
            ) : null}
          </div>
          <div className="text-xs text-muted-foreground">
            Avoid duplicates: we block crops with the same name.
          </div>
          {isSubmittingCrop ? <p className="text-sm text-muted-foreground">Saving crop…</p> : null}
        </form>
      </InlineCreateSheet>

      {hasVarieties && isMobile ? (
        <StickyActionBar align="end" aria-label="Quick add variety" position="fixed">
          <Button onClick={() => handleAdd(activeCropId)} className="w-full sm:w-auto">
            <Plus className="h-4 w-4 mr-2" aria-hidden />
            Add Crop Variety
          </Button>
        </StickyActionBar>
      ) : null}
    </div>
  );
}
