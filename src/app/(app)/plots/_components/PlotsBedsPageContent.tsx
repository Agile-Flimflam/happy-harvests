'use client';

import { useState } from 'react';
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
import FormDialog from '@/components/dialogs/FormDialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PlotForm } from '../_components/PlotForm';
import { BedForm } from '../_components/BedForm';
import { deletePlot, deleteBed } from '../_actions';
import { Pencil, Trash2, Plus, MapPin, Sunrise, Sunset, Droplet } from 'lucide-react';
import { toast } from 'sonner';
import PageHeader from '@/components/page-header';
import PageContent from '@/components/page-content';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';

type Plot = Tables<'plots'>;
type Bed = Tables<'beds'>;
type Location = Tables<'locations'>;
type PlotWithBeds = Plot & { beds: Bed[]; locations: Location | null; totalAcreage: number };

export interface PlotsBedsPageContentProps {
  plotsWithBeds: PlotWithBeds[];
  locations: Location[];
  weatherByLocation?: Record<string, WeatherSnapshot>;
}

// Helper function to group plots by location
const groupPlotsByLocation = (plots: PlotWithBeds[]) => {
  return plots.reduce(
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
};

export function PlotsBedsPageContent({
  plotsWithBeds,
  locations,
  weatherByLocation = {},
}: PlotsBedsPageContentProps) {
  const [isPlotDialogOpen, setIsPlotDialogOpen] = useState(false);
  const [isBedDialogOpen, setIsBedDialogOpen] = useState(false);
  const [editingPlot, setEditingPlot] = useState<Plot | null>(null);
  const [editingBed, setEditingBed] = useState<Bed | null>(null);
  const [currentPlotForBed, setCurrentPlotForBed] = useState<Plot | null>(null);
  const [deletePlotId, setDeletePlotId] = useState<number | null>(null);
  const [deleteBedId, setDeleteBedId] = useState<number | null>(null);
  const [isDeletingPlot, setIsDeletingPlot] = useState(false);
  const [isDeletingBed, setIsDeletingBed] = useState(false);

  const plotsByLocation = groupPlotsByLocation(plotsWithBeds);
  const hasPlots = plotsWithBeds.length > 0;

  const handleEditPlot = (plot: Plot) => {
    setEditingPlot(plot);
    setIsPlotDialogOpen(true);
  };

  const handleAddPlot = () => {
    setEditingPlot(null);
    setIsPlotDialogOpen(true);
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

  const closePlotDialog = () => {
    setIsPlotDialogOpen(false);
    setEditingPlot(null);
  };

  const handleEditBed = (bed: Bed, plot: Plot) => {
    setEditingBed(bed);
    setCurrentPlotForBed(plot);
    setIsBedDialogOpen(true);
  };

  const handleAddBed = (plot: Plot) => {
    setEditingBed(null);
    setCurrentPlotForBed(plot);
    setIsBedDialogOpen(true);
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

  const closeBedDialog = () => {
    setIsBedDialogOpen(false);
    setEditingBed(null);
    setCurrentPlotForBed(null);
  };

  const allPlots: PlotWithBeds[] = plotsWithBeds;

  const renderPlotCard = (plot: PlotWithBeds) => {
    return (
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
                          <div className="flex items-center justify-end gap-1">
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
  };

  const renderLocationSection = (
    locationKey: string,
    {
      location,
      locationName,
      plots,
    }: { location: Location | null; locationName: string; plots: PlotWithBeds[] },
    weatherForLocation?: WeatherSnapshot
  ) => {
    return (
      <div key={locationKey} className="space-y-6">
        {/* Location Header */}
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

        {/* Plots Grid */}
        <div className="grid gap-4">{plots.map(renderPlotCard)}</div>
      </div>
    );
  };

  return (
    <div>
      <PageHeader
        title="Plots & Beds"
        action={
          hasPlots ? (
            <Button onClick={handleAddPlot} size="sm" className="w-full sm:w-auto">
              <Plus className="h-4 w-4 mr-2" />
              Add Plot
            </Button>
          ) : undefined
        }
      />

      <FormDialog
        open={isPlotDialogOpen}
        onOpenChange={setIsPlotDialogOpen}
        title={editingPlot ? 'Edit Plot' : 'Add New Plot'}
        description={
          editingPlot ? 'Update the details of the plot.' : 'Enter the details for the new plot.'
        }
        submitLabel={editingPlot ? 'Update Plot' : 'Create Plot'}
        formId="plotFormSubmit"
        className="sm:max-w-[425px]"
      >
        <PlotForm
          plot={editingPlot}
          locations={locations}
          closeDialog={closePlotDialog}
          formId="plotFormSubmit"
        />
      </FormDialog>

      {/* Delete Plot Confirmation */}
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

      <FormDialog
        open={isBedDialogOpen}
        onOpenChange={setIsBedDialogOpen}
        title={editingBed ? 'Edit Bed' : `Add New Bed to ${currentPlotForBed?.name ?? 'Plot'}`}
        description={
          editingBed ? 'Update the details of the bed.' : 'Enter the details for the new bed.'
        }
        submitLabel={editingBed ? 'Update Bed' : 'Create Bed'}
        formId="bedFormSubmit"
        className="sm:max-w-[425px]"
      >
        <BedForm
          bed={editingBed}
          plots={allPlots}
          closeDialog={closeBedDialog}
          formId="bedFormSubmit"
          initialPlotId={currentPlotForBed?.plot_id ?? null}
        />
      </FormDialog>

      {/* Delete Bed Confirmation */}
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

      <PageContent>
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
            {Object.entries(plotsByLocation).map(([locationKey, locationData]) =>
              renderLocationSection(
                locationKey,
                locationData,
                locationData.location ? weatherByLocation[locationData.location.id] : undefined
              )
            )}
          </div>
        )}
      </PageContent>
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
      {/* Moon phase is now shown inline via WeatherBadge */}
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

// formatMoonPhase now imported from utils
