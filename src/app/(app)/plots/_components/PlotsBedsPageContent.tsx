'use client';

import { useActionState, useEffect, useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  Pencil,
  Trash2,
  Plus,
  MapPin,
  Sunrise,
  Sunset,
  Droplet,
  LayoutGrid,
  Sprout,
  Layers,
} from 'lucide-react';

import { WeatherBadge } from '@/components/weather/WeatherBadge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { formatSquareFeet, formatAcres, squareFeetToAcres } from '@/lib/utils';
import type { Tables } from '@/lib/supabase-server';
import type { WeatherSnapshot } from '../../locations/actions';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PlotForm } from '../_components/PlotForm';
import { BedForm } from '../_components/BedForm';
import {
  deletePlot,
  deleteBed,
  bulkCreateBeds,
  bulkCreatePlots,
  type BulkBedFormState,
  type BulkPlotFormState,
} from '../actions';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { FlowShell } from '@/components/ui/flow-shell';
import { RecentChips } from '@/components/ui/recent-chips';
import { StickyActionBar } from '@/components/ui/sticky-action-bar';
import { InlineCreateSheet } from '@/components/ui/inline-create-sheet';
import { useIsMobile } from '@/hooks/use-mobile';
import { rememberLocationSelection } from '../../locations/_actions';
import type { QuickCreatePrefs } from '@/lib/quick-create-prefs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type Plot = Tables<'plots'>;
type Bed = Tables<'beds'>;
type Location = Tables<'locations'>;
type PlotWithBeds = Plot & { beds: Bed[]; locations: Location | null; totalAcreage: number };

type BedSizePreset = { id: string; label: string; lengthInches: number; widthInches: number };

const BED_SIZE_PRESETS: BedSizePreset[] = [
  { id: '30x50', label: '50 ft × 30 in', lengthInches: 600, widthInches: 30 },
  { id: '30x25', label: '25 ft × 30 in', lengthInches: 300, widthInches: 30 },
  { id: '48x20', label: '20 ft × 48 in', lengthInches: 240, widthInches: 48 },
];

const PLOT_COUNT_PRESETS = [3, 5, 10];

export interface PlotsBedsPageContentProps {
  plotsWithBeds: PlotWithBeds[];
  locations: Location[];
  weatherByLocation?: Record<string, WeatherSnapshot>;
  quickCreatePrefs?: QuickCreatePrefs | null;
  initialLocationId?: string | null;
}

const groupPlotsByLocation = (plots: PlotWithBeds[]) =>
  plots.reduce(
    (acc, plot) => {
      const locationKey = plot.locations?.id || 'no-location';
      const locationName = plot.locations?.name || 'No Location Assigned';

      if (!acc[locationKey]) {
        acc[locationKey] = {
          location: plot.locations,
          locationName,
          plots: [],
        };
      }
      acc[locationKey].plots.push(plot);
      return acc;
    },
    {} as Record<string, { location: Location | null; locationName: string; plots: PlotWithBeds[] }>
  );

export function PlotsBedsPageContent({
  plotsWithBeds,
  locations,
  weatherByLocation = {},
  quickCreatePrefs = null,
  initialLocationId = null,
}: PlotsBedsPageContentProps) {
  const [isPlotSheetOpen, setIsPlotSheetOpen] = useState(false);
  const [isBedSheetOpen, setIsBedSheetOpen] = useState(false);
  const [isBulkSheetOpen, setIsBulkSheetOpen] = useState(false);
  const [bulkMode, setBulkMode] = useState<'plot' | 'bed'>('plot');
  const [editingPlot, setEditingPlot] = useState<Plot | null>(null);
  const [editingBed, setEditingBed] = useState<Bed | null>(null);
  const [currentPlotForBed, setCurrentPlotForBed] = useState<Plot | null>(null);
  const [deletePlotId, setDeletePlotId] = useState<number | null>(null);
  const [deleteBedId, setDeleteBedId] = useState<number | null>(null);
  const [isDeletingPlot, setIsDeletingPlot] = useState(false);
  const [isDeletingBed, setIsDeletingBed] = useState(false);
  const defaultLocation =
    initialLocationId ?? quickCreatePrefs?.lastLocationId ?? locations[0]?.id ?? null;
  const [locationFilter, setLocationFilter] = useState<string | null>(defaultLocation);
  const [bedSizePreset, setBedSizePreset] = useState<BedSizePreset | null>(() => {
    const presetFromPrefs = quickCreatePrefs?.commonBedSize
      ? BED_SIZE_PRESETS.find(
          (preset) =>
            preset.lengthInches === quickCreatePrefs.commonBedSize?.lengthInches &&
            preset.widthInches === quickCreatePrefs.commonBedSize?.widthInches
        )
      : null;
    return presetFromPrefs ?? BED_SIZE_PRESETS[0];
  });
  const [, startPersistLocation] = useTransition();

  const plotsByLocation = groupPlotsByLocation(plotsWithBeds);
  const hasPlots = plotsWithBeds.length > 0;
  const isMobile = useIsMobile();

  const locationChips = useMemo(
    () =>
      Object.entries(plotsByLocation).map(([key, data]) => ({
        label: data.locationName,
        value: key,
      })),
    [plotsByLocation]
  );

  useEffect(() => {
    if (!locationFilter) return;
    const exists = locations.some((loc) => loc.id === locationFilter);
    if (!exists) {
      setLocationFilter(null);
    }
  }, [locations, locationFilter]);

  const handleEditPlot = (plot: Plot) => {
    setEditingPlot(plot);
    setIsPlotSheetOpen(true);
  };

  const handleAddPlot = () => {
    setEditingPlot(null);
    setIsPlotSheetOpen(true);
  };

  const openDeletePlot = (id: number) => setDeletePlotId(id);
  const confirmDeletePlot = async () => {
    if (deletePlotId == null) return;
    try {
      setIsDeletingPlot(true);
      const result = await deletePlot(deletePlotId);
      if (result.message.startsWith('Database Error:') || result.message.startsWith('Error:')) {
        toast.error(result.message);
      } else {
        toast.success(result.message);
      }
    } finally {
      setIsDeletingPlot(false);
      setDeletePlotId(null);
    }
  };

  const closePlotSheet = () => {
    setIsPlotSheetOpen(false);
    setEditingPlot(null);
  };

  const handleEditBed = (bed: Bed, plot: Plot) => {
    setEditingBed(bed);
    setCurrentPlotForBed(plot);
    setIsBedSheetOpen(true);
  };

  const handleAddBed = (plot: Plot) => {
    setEditingBed(null);
    setCurrentPlotForBed(plot);
    setIsBedSheetOpen(true);
  };

  const openDeleteBed = (id: number) => setDeleteBedId(id);
  const confirmDeleteBed = async () => {
    if (deleteBedId == null) return;
    try {
      setIsDeletingBed(true);
      const result = await deleteBed(deleteBedId);
      if (result.message.startsWith('Database Error:') || result.message.startsWith('Error:')) {
        toast.error(result.message);
      } else {
        toast.success(result.message);
      }
    } finally {
      setIsDeletingBed(false);
      setDeleteBedId(null);
    }
  };

  const closeBedSheet = () => {
    setIsBedSheetOpen(false);
    setEditingBed(null);
    setCurrentPlotForBed(null);
  };

  const handleLocationSelect = (value: string | null) => {
    setLocationFilter(value);
    const isRealLocation = value ? locations.some((loc) => loc.id === value) : false;
    if (value && isRealLocation) {
      startPersistLocation(() => rememberLocationSelection(value));
    }
  };

  const allPlots: PlotWithBeds[] = plotsWithBeds;

  const renderPlotCard = (plot: PlotWithBeds) => (
    <Card key={plot.plot_id} className="shadow-sm hover:shadow-md transition-shadow">
      <CardHeader className="pb-0">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold">{plot.name}</CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => handleAddBed(plot)}>
              <Plus className="h-4 w-4 mr-1" />
              Add Bed
            </Button>
            <Button variant="ghost" size="sm" onClick={() => handleEditPlot(plot)}>
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => openDeletePlot(plot.plot_id)}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {plot.beds.length > 0 ? (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="font-semibold">Bed</TableHead>
                  <TableHead className="font-semibold">Dimensions</TableHead>
                  <TableHead className="font-semibold">Sq Ft</TableHead>
                  <TableHead className="font-semibold">Acres</TableHead>
                  <TableHead className="text-right font-semibold">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {plot.beds.map((bed) => {
                  const areaSqIn =
                    bed.length_inches && bed.width_inches
                      ? bed.length_inches * bed.width_inches
                      : null;
                  const areaSqFt = areaSqIn != null ? areaSqIn / 144 : null;
                  const acresRaw = areaSqFt != null ? squareFeetToAcres(areaSqFt) : null;
                  const sqFtDisplay = areaSqFt != null ? formatSquareFeet(areaSqFt) : null;
                  const sqFtTooltip =
                    areaSqFt != null ? formatSquareFeet(areaSqFt, { variant: 'tooltip' }) : null;
                  const acresDisplay = acresRaw != null ? formatAcres(acresRaw) : null;
                  const acresTooltip =
                    acresRaw != null ? formatAcres(acresRaw, { variant: 'tooltip' }) : null;
                  return (
                    <TableRow key={bed.id} className="hover:bg-muted/30">
                      <TableCell className="font-medium">
                        {bed.name ? bed.name : `#${bed.id}`}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {bed.length_inches && bed.width_inches
                          ? `${bed.length_inches}" × ${bed.width_inches}`
                          : '—'}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {areaSqFt !== null ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="cursor-help">{sqFtDisplay} sq ft</span>
                            </TooltipTrigger>
                            <TooltipContent>{sqFtTooltip} sq ft</TooltipContent>
                          </Tooltip>
                        ) : (
                          '—'
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {acresRaw !== null ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="cursor-help">
                                {acresDisplay ? `${acresDisplay} ac` : '—'}
                              </span>
                            </TooltipTrigger>
                            {acresTooltip && <TooltipContent>{acresTooltip} ac</TooltipContent>}
                          </Tooltip>
                        ) : (
                          '—'
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button asChild variant="outline" size="sm" className="gap-1">
                            <Link href={`/plantings?mode=direct&bedId=${bed.id}`}>
                              <Sprout className="h-3 w-3" aria-hidden />
                              Plan planting here
                            </Link>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditBed(bed, plot)}
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openDeleteBed(bed.id)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <p className="text-sm">No beds in this plot yet</p>
            <Button variant="link" size="sm" onClick={() => handleAddBed(plot)} className="mt-2">
              Add the first bed
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );

  const renderLocationSection = (
    locationKey: string,
    {
      location,
      locationName,
      plots,
    }: { location: Location | null; locationName: string; plots: PlotWithBeds[] },
    weatherForLocation?: WeatherSnapshot
  ) => (
    <div key={locationKey} className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b pb-4 mb-6">
        <div className="flex items-center gap-3 min-w-0">
          <MapPin className="h-5 w-5 text-muted-foreground" />
          <div>
            <h2 className="text-xl font-semibold">{locationName}</h2>
            {location && location.city && location.state && (
              <p className="text-sm text-muted-foreground">
                {location.city}, {location.state}
              </p>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 sm:gap-6 justify-start sm:justify-end">
          {location ? <LocationWeather weather={weatherForLocation} /> : null}
          <span className="text-sm text-muted-foreground">
            {plots.length} plot{plots.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>
      <div className="grid gap-4">{plots.map(renderPlotCard)}</div>
    </div>
  );

  const activeLocationId =
    locationFilter && locationFilter !== 'no-location' ? locationFilter : undefined;

  return (
    <div>
      <InlineCreateSheet
        open={isPlotSheetOpen}
        onOpenChange={setIsPlotSheetOpen}
        title={editingPlot ? 'Edit Plot' : 'Add Plot'}
        description={
          editingPlot
            ? 'Update the details of the plot.'
            : 'Create a plot and link it to a location.'
        }
        primaryAction={{
          label: editingPlot ? 'Update Plot' : 'Create Plot',
          formId: 'plotFormSubmit',
        }}
        secondaryAction={{ label: 'Cancel', onClick: closePlotSheet }}
      >
        <PlotForm
          plot={editingPlot}
          locations={locations}
          closeDialog={closePlotSheet}
          formId="plotFormSubmit"
          defaultLocationId={activeLocationId ?? defaultLocation}
        />
      </InlineCreateSheet>

      <InlineCreateSheet
        open={isBedSheetOpen}
        onOpenChange={setIsBedSheetOpen}
        title={
          editingBed
            ? 'Edit Bed'
            : `Add Bed${currentPlotForBed ? ` to ${currentPlotForBed.name}` : ''}`
        }
        description={
          editingBed ? 'Update the details of the bed.' : 'Add beds with consistent sizes quickly.'
        }
        primaryAction={{
          label: editingBed ? 'Update Bed' : 'Create Bed',
          formId: 'bedFormSubmit',
        }}
        secondaryAction={{ label: 'Cancel', onClick: closeBedSheet }}
      >
        <div className="space-y-4">
          <RecentChips
            items={BED_SIZE_PRESETS.map((preset) => ({
              label: preset.label,
              value: preset.id,
            }))}
            activeValue={bedSizePreset?.id ?? null}
            onSelect={(value) => {
              if (!value) {
                setBedSizePreset(BED_SIZE_PRESETS[0]);
                return;
              }
              const nextPreset = BED_SIZE_PRESETS.find((preset) => preset.id === value);
              if (nextPreset) {
                setBedSizePreset(nextPreset);
              }
            }}
            ariaLabel="Common bed sizes"
            clearLabel="Reset sizes"
          />
          <BedForm
            bed={editingBed}
            plots={allPlots}
            closeDialog={closeBedSheet}
            formId="bedFormSubmit"
            initialPlotId={currentPlotForBed?.plot_id ?? null}
            defaultSize={
              editingBed
                ? null
                : bedSizePreset
                  ? {
                      lengthInches: bedSizePreset.lengthInches,
                      widthInches: bedSizePreset.widthInches,
                    }
                  : null
            }
          />
        </div>
      </InlineCreateSheet>

      <InlineCreateSheet
        open={isBulkSheetOpen}
        onOpenChange={setIsBulkSheetOpen}
        title={bulkMode === 'plot' ? 'Bulk add plots' : 'Bulk add beds'}
        description={
          bulkMode === 'plot'
            ? 'Generate multiple plots with incremental names and duplicate checks.'
            : 'Generate multiple beds with size presets, duplicate detection, and unit checks.'
        }
        primaryAction={{
          label: bulkMode === 'plot' ? 'Create plots' : 'Create beds',
          formId: bulkMode === 'plot' ? 'bulkPlotForm' : 'bulkBedForm',
        }}
        secondaryAction={{
          label: 'Cancel',
          onClick: () => {
            setIsBulkSheetOpen(false);
          },
        }}
      >
        {bulkMode === 'plot' ? (
          <BulkPlotForm
            locations={locations}
            defaultLocationId={activeLocationId ?? defaultLocation}
            onSuccess={() => setIsBulkSheetOpen(false)}
          />
        ) : (
          <BulkBedForm
            locations={locations}
            plots={plotsWithBeds}
            defaultLocationId={activeLocationId ?? defaultLocation}
            defaultSize={bedSizePreset}
            onSuccess={() => setIsBulkSheetOpen(false)}
          />
        )}
      </InlineCreateSheet>

      <FlowShell
        title="Plots & Beds"
        description="Grid-aligned layout with mobile-friendly actions."
        icon={<LayoutGrid className="h-5 w-5" aria-hidden />}
        actions={
          hasPlots && !isMobile ? (
            <div className="flex items-center gap-2">
              <Button onClick={handleAddPlot} size="sm" className="w-full sm:w-auto">
                <Plus className="h-4 w-4 mr-2" aria-hidden />
                Add Plot
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setBulkMode('plot');
                  setIsBulkSheetOpen(true);
                }}
                className="gap-1"
              >
                <Layers className="h-4 w-4" aria-hidden />
                Bulk plots
              </Button>
            </div>
          ) : undefined
        }
      >
        <Dialog
          open={deletePlotId != null}
          onOpenChange={(open) => {
            if (!open) setDeletePlotId(null);
          }}
        >
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Delete plot?</DialogTitle>
              <DialogDescription>
                This will permanently delete the plot and all associated beds. This action cannot be
                undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">Cancel</Button>
              </DialogClose>
              <Button
                variant="destructive"
                onClick={confirmDeletePlot}
                disabled={isDeletingPlot}
                aria-disabled={isDeletingPlot}
              >
                {isDeletingPlot ? 'Deleting…' : 'Delete'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog
          open={deleteBedId != null}
          onOpenChange={(open) => {
            if (!open) setDeleteBedId(null);
          }}
        >
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Delete bed?</DialogTitle>
              <DialogDescription>
                This will permanently delete the bed. This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">Cancel</Button>
              </DialogClose>
              <Button
                variant="destructive"
                onClick={confirmDeleteBed}
                disabled={isDeletingBed}
                aria-disabled={isDeletingBed}
              >
                {isDeletingBed ? 'Deleting…' : 'Delete'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <div className="space-y-4">
          {locationChips.length > 1 ? (
            <RecentChips
              items={locationChips}
              activeValue={locationFilter}
              onSelect={handleLocationSelect}
              ariaLabel="Filter plots by location"
              clearLabel="Show all"
            />
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                setBulkMode('plot');
                setIsBulkSheetOpen(true);
              }}
            >
              <Layers className="mr-2 h-4 w-4" aria-hidden />
              Bulk plots
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setBulkMode('bed');
                setIsBulkSheetOpen(true);
              }}
            >
              <Layers className="mr-2 h-4 w-4" aria-hidden />
              Bulk beds
            </Button>
          </div>
        </div>

        {!hasPlots ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <MapPin className="h-10 w-10" />
              </EmptyMedia>
              <EmptyTitle>No plots yet</EmptyTitle>
              <EmptyDescription>Create a plot to add beds and track your garden.</EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button onClick={handleAddPlot}>
                <span className="flex items-center gap-1">
                  <Plus className="h-4 w-4" />
                  Add Plot
                </span>
              </Button>
            </EmptyContent>
          </Empty>
        ) : (
          <div className="space-y-8">
            {Object.entries(plotsByLocation)
              .filter(([key]) => !locationFilter || locationFilter === key)
              .map(([locationKey, locationData]) =>
                renderLocationSection(
                  locationKey,
                  locationData,
                  locationData.location ? weatherByLocation[locationData.location.id] : undefined
                )
              )}
          </div>
        )}
      </FlowShell>

      {hasPlots ? (
        <StickyActionBar align="end" aria-label="Quick plot actions" position="fixed">
          <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
            <Button onClick={handleAddPlot} className="w-full sm:w-auto">
              <Plus className="h-4 w-4 mr-2" aria-hidden />
              Add Plot
            </Button>
            <Button
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => {
                setBulkMode('bed');
                setIsBulkSheetOpen(true);
              }}
            >
              <Layers className="h-4 w-4 mr-2" aria-hidden />
              Bulk beds
            </Button>
          </div>
        </StickyActionBar>
      ) : null}
    </div>
  );
}

function LocationWeather({ weather }: { weather?: WeatherSnapshot }) {
  if (!weather) {
    return <span className="text-muted-foreground text-sm">Set coordinates to enable weather</span>;
  }

  const { current } = weather;
  const tempF = current.temp;

  return (
    <div className="flex items-center gap-4 text-sm">
      <WeatherBadge
        icon={current.weather?.icon}
        tempF={tempF}
        description={current.weather?.description || null}
        inlineDescription={false}
        hawaiianMoon={weather.moonPhaseLabel ?? undefined}
        size="sm"
      />
      {typeof current.sunrise === 'number' && (
        <span className="inline-flex items-center gap-1 text-muted-foreground">
          <Sunrise className="h-3 w-3" /> {formatUnixToLocalTime(current.sunrise)}
        </span>
      )}
      {typeof current.sunset === 'number' && (
        <span className="inline-flex items-center gap-1 text-muted-foreground">
          <Sunset className="h-3 w-3" /> {formatUnixToLocalTime(current.sunset)}
        </span>
      )}
      {typeof current.humidity === 'number' && (
        <span className="inline-flex items-center gap-1 text-muted-foreground">
          <Droplet className="h-3 w-3" /> {current.humidity}%
        </span>
      )}
    </div>
  );
}

function formatUnixToLocalTime(unixSeconds: number) {
  try {
    const d = new Date(unixSeconds * 1000);
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  } catch {
    return '';
  }
}

function ErrorText({ message }: { message?: string | string[] | Record<string, unknown> }) {
  const firstString = (value: unknown): string | undefined => {
    if (typeof value === 'string') return value;
    if (Array.isArray(value)) {
      const first = value.find((item): item is string => typeof item === 'string');
      return first;
    }
    if (value && typeof value === 'object') {
      const record = value as Record<string, unknown>;
      // Handle size field objects explicitly
      if ('length_inches' in record || 'width_inches' in record) {
        return firstString(record.length_inches ?? record.width_inches);
      }
      // Fallback: return the first string-ish entry found
      for (const key of Object.keys(record)) {
        const normalized = firstString(record[key]);
        if (normalized) return normalized;
      }
    }
    return undefined;
  };

  const content = firstString(message);
  if (!content) return null;
  return <p className="text-sm text-destructive">{content}</p>;
}

function BulkPlotForm({
  locations,
  defaultLocationId,
  onSuccess,
}: {
  locations: Location[];
  defaultLocationId?: string | null;
  onSuccess: () => void;
}) {
  const initialState: BulkPlotFormState = { message: '', errors: {} };
  const [state, formAction] = useActionState(bulkCreatePlots, initialState);
  const [locationId, setLocationId] = useState<string>(defaultLocationId ?? locations[0]?.id ?? '');
  const [baseName, setBaseName] = useState('Plot');
  const [count, setCount] = useState<number>(PLOT_COUNT_PRESETS[1]);

  const normalizeError = (value: unknown): string | string[] | undefined => {
    if (typeof value === 'string') return value;
    if (Array.isArray(value) && value.every((item) => typeof item === 'string')) {
      return value;
    }
    return undefined;
  };

  const locationError = normalizeError(state.errors?.location_id);
  const baseNameError = normalizeError(state.errors?.base_name);
  const countError = normalizeError(state.errors?.count);

  useEffect(() => {
    if (!state.message) return;
    if (state.errors && Object.keys(state.errors).length > 0) {
      toast.error(state.message);
      return;
    }
    toast.success(state.message);
    onSuccess();
  }, [onSuccess, state]);

  useEffect(() => {
    if (defaultLocationId && locationId !== defaultLocationId) {
      setLocationId(defaultLocationId);
    }
  }, [defaultLocationId, locationId]);

  return (
    <form id="bulkPlotForm" action={formAction} className="space-y-4">
      <input type="hidden" name="location_id" value={locationId} />
      <div className="space-y-2">
        <Label>Location</Label>
        <Select value={locationId} onValueChange={setLocationId}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select a location" />
          </SelectTrigger>
          <SelectContent>
            {locations.map((loc) => (
              <SelectItem key={loc.id} value={loc.id}>
                {loc.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <ErrorText message={locationError} />
      </div>
      <div className="space-y-2">
        <Label>Name prefix</Label>
        <Input
          name="base_name"
          value={baseName}
          onChange={(event) => setBaseName(event.target.value)}
          required
        />
        <ErrorText message={baseNameError} />
      </div>
      <div className="space-y-2">
        <Label>How many plots?</Label>
        <div className="flex items-center gap-2">
          {PLOT_COUNT_PRESETS.map((preset) => (
            <Button
              key={preset}
              type="button"
              variant={count === preset ? 'secondary' : 'outline'}
              size="sm"
              onClick={() => setCount(preset)}
            >
              {preset}
            </Button>
          ))}
          <Input
            className="w-20"
            type="number"
            name="count"
            value={count}
            min={1}
            max={50}
            onChange={(event) => setCount(Number(event.target.value))}
          />
        </div>
        <ErrorText message={countError} />
      </div>
      {state.skipped && state.skipped.length > 0 ? (
        <p className="text-sm text-muted-foreground">
          Skipped duplicates: {state.skipped.join(', ')}
        </p>
      ) : null}
    </form>
  );
}

function BulkBedForm({
  locations,
  plots,
  defaultLocationId,
  defaultSize,
  onSuccess,
}: {
  locations: Location[];
  plots: PlotWithBeds[];
  defaultLocationId?: string | null;
  defaultSize?: BedSizePreset | null;
  onSuccess: () => void;
}) {
  const initialState: BulkBedFormState = { message: '', errors: {} };
  const [state, formAction] = useActionState(bulkCreateBeds, initialState);
  const [locationId, setLocationId] = useState<string>(defaultLocationId ?? locations[0]?.id ?? '');
  const plotsForLocation = useMemo(
    () =>
      plots.filter(
        (plot) =>
          locationId === '' ||
          plot.location_id === locationId ||
          (locationId === 'no-location' && !plot.location_id)
      ),
    [locationId, plots]
  );
  const [plotId, setPlotId] = useState<number | null>(() => {
    const plotMatch = plotsForLocation[0];
    return plotMatch?.plot_id ?? null;
  });
  const [baseName, setBaseName] = useState('Bed');
  const [count, setCount] = useState<number>(5);
  const [sizePreset, setSizePreset] = useState<BedSizePreset>(defaultSize ?? BED_SIZE_PRESETS[0]);

  const normalizeError = (value: unknown): string | string[] | undefined => {
    if (typeof value === 'string') return value;
    if (Array.isArray(value) && value.every((item) => typeof item === 'string')) {
      return value;
    }
    return undefined;
  };

  useEffect(() => {
    if (defaultSize) {
      setSizePreset(defaultSize);
    }
  }, [defaultSize]);

  useEffect(() => {
    if (!state.message) return;
    if (state.errors && Object.keys(state.errors).length > 0) {
      toast.error(state.message);
      return;
    }
    toast.success(state.message);
    onSuccess();
  }, [onSuccess, state]);

  useEffect(() => {
    const firstPlot = plotsForLocation[0];
    const plotInScope = plotId ? plotsForLocation.some((plot) => plot.plot_id === plotId) : false;
    if (!plotInScope) {
      setPlotId(firstPlot?.plot_id ?? null);
    }
  }, [plotId, plotsForLocation]);

  const locationError = normalizeError(state.errors?.location_id);
  const plotError = normalizeError(state.errors?.plot_id);
  const baseNameError = normalizeError(state.errors?.base_name);
  const countError = normalizeError(state.errors?.count);

  return (
    <form id="bulkBedForm" action={formAction} className="space-y-4">
      <input type="hidden" name="unit" value="in" />
      <input type="hidden" name="location_id" value={locationId} />
      <div className="space-y-2">
        <Label>Location</Label>
        <Select value={locationId} onValueChange={(value) => setLocationId(value)}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select a location" />
          </SelectTrigger>
          <SelectContent>
            {locations.map((loc) => (
              <SelectItem key={loc.id} value={loc.id}>
                {loc.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <ErrorText message={locationError} />
      </div>

      <div className="space-y-2">
        <Label>Plot</Label>
        <Select
          value={plotId ? String(plotId) : ''}
          onValueChange={(value) => setPlotId(Number(value))}
          disabled={plotsForLocation.length === 0}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select a plot" />
          </SelectTrigger>
          <SelectContent>
            {plotsForLocation.map((plot) => (
              <SelectItem key={plot.plot_id} value={String(plot.plot_id)}>
                {plot.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <input type="hidden" name="plot_id" value={plotId ?? ''} />
        <ErrorText message={plotError} />
      </div>

      <div className="space-y-2">
        <Label>Name prefix (optional)</Label>
        <Input
          name="base_name"
          value={baseName}
          onChange={(event) => setBaseName(event.target.value)}
          placeholder="Bed"
        />
        <ErrorText message={baseNameError} />
      </div>

      <div className="space-y-2">
        <Label>Bed size preset</Label>
        <RecentChips
          items={BED_SIZE_PRESETS.map((preset) => ({
            label: preset.label,
            value: preset.id,
          }))}
          activeValue={sizePreset.id}
          onSelect={(value) => {
            if (!value) {
              setSizePreset(BED_SIZE_PRESETS[0]);
              return;
            }
            const next = BED_SIZE_PRESETS.find((preset) => preset.id === value);
            if (next) {
              setSizePreset(next);
            }
          }}
          ariaLabel="Choose bed size preset"
          clearLabel="Reset"
        />
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Length (in)</Label>
            <Input
              type="number"
              name="length_inches"
              value={sizePreset.lengthInches}
              onChange={(event) =>
                setSizePreset((prev) => ({
                  ...prev,
                  lengthInches: Number(event.target.value),
                }))
              }
              required
              min={1}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Width (in)</Label>
            <Input
              type="number"
              name="width_inches"
              value={sizePreset.widthInches}
              onChange={(event) =>
                setSizePreset((prev) => ({
                  ...prev,
                  widthInches: Number(event.target.value),
                }))
              }
              required
              min={1}
            />
          </div>
        </div>
        <ErrorText message={state.errors?.size} />
      </div>

      <div className="space-y-2">
        <Label>How many beds?</Label>
        <div className="flex items-center gap-2">
          {[5, 10, 15].map((preset) => (
            <Button
              key={preset}
              type="button"
              variant={count === preset ? 'secondary' : 'outline'}
              size="sm"
              onClick={() => setCount(preset)}
            >
              {preset}
            </Button>
          ))}
          <Input
            className="w-20"
            type="number"
            name="count"
            value={count}
            min={1}
            max={50}
            onChange={(event) => setCount(Number(event.target.value))}
          />
        </div>
        <ErrorText message={countError} />
      </div>
      {state.skipped && state.skipped.length > 0 ? (
        <p className="text-sm text-muted-foreground">
          Skipped duplicates: {state.skipped.join(', ')}
        </p>
      ) : null}
    </form>
  );
}
