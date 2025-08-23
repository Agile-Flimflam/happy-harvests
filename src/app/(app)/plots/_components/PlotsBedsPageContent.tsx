'use client';

import { useState, useEffect } from 'react';
import { WeatherBadge } from '@/components/weather/WeatherBadge';
import Fraction from 'fraction.js';
import type { Tables } from '@/lib/supabase-server';
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PlotForm } from '../_components/PlotForm';
import { BedForm } from '../_components/BedForm';
import { deletePlot, deleteBed } from '../_actions';
import { Pencil, Trash2, PlusCircle, MapPin, Sunrise, Sunset, Moon, Droplet } from 'lucide-react';
import { toast } from "sonner";

type Plot = Tables<'plots'>;
type Bed = Tables<'beds'>;
type Location = Tables<'locations'>;
type PlotWithBeds = Plot & { beds: Bed[]; locations: Location | null; totalAcreage: number };

export interface PlotsBedsPageContentProps {
  plotsWithBeds: PlotWithBeds[];
  locations: Location[];
}

// Helper function to group plots by location
const groupPlotsByLocation = (plots: PlotWithBeds[]) => {
  return plots.reduce((acc, plot) => {
    const locationKey = plot.locations?.id || 'no-location';
    const locationName = plot.locations?.name || 'No Location Assigned';
    
    if (!acc[locationKey]) {
      acc[locationKey] = {
        location: plot.locations,
        locationName,
        plots: []
      };
    }
    acc[locationKey].plots.push(plot);
    return acc;
  }, {} as Record<string, { location: Location | null; locationName: string; plots: PlotWithBeds[] }>);
};

export function PlotsBedsPageContent({ plotsWithBeds, locations }: PlotsBedsPageContentProps) {
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
                <PlusCircle className="h-4 w-4 mr-1" />
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
                    const areaSqIn = (bed.length_inches && bed.width_inches) ? bed.length_inches * bed.width_inches : null;
                    const areaSqFt = areaSqIn ? areaSqIn / 144 : null;
                    const acreage = areaSqFt ? areaSqFt / 43560 : null;
                    return (
                      <TableRow key={bed.id} className="hover:bg-muted/30">
                        <TableCell className="font-medium">#{bed.id}</TableCell>
                        <TableCell className="font-mono text-sm">
                          {bed.length_inches && bed.width_inches 
                            ? `${bed.length_inches}" × ${bed.width_inches}"`
                            : '—'
                          }
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {areaSqFt !== null ? `${Math.round(areaSqFt)} sq ft` : '—'}
                        </TableCell>
                        <TableCell>
                          {acreage !== null && acreage > 0 
                            ? new Fraction(acreage).toFraction(true) 
                            : '—'
                          }
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="sm" onClick={() => handleEditBed(bed, plot)}>
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
              <Button 
                variant="link" 
                size="sm" 
                onClick={() => handleAddBed(plot)}
                className="mt-2"
              >
                Add the first bed
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  const renderLocationSection = (locationKey: string, { location, locationName, plots }: { location: Location | null; locationName: string; plots: PlotWithBeds[] }) => {
    return (
      <div key={locationKey} className="space-y-6">
        {/* Location Header */}
        <div className="flex items-center justify-between border-b pb-4 mb-6">
          <div className="flex items-center gap-3">
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
          <div className="flex items-center gap-6">
            {location ? (
              <LocationWeather id={location.id} latitude={location.latitude} longitude={location.longitude} />
            ) : null}
            <span className="text-sm text-muted-foreground">
              {plots.length} plot{plots.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>

        {/* Plots Grid */}
        <div className="grid gap-4">
          {plots.map(renderPlotCard)}
        </div>
      </div>
    );
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Plots & Beds</h1>
        <Button onClick={handleAddPlot} size="sm">
          <PlusCircle className="h-4 w-4 mr-2" />
          Add Plot
        </Button>
      </div>

      <Dialog open={isPlotDialogOpen} onOpenChange={setIsPlotDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{editingPlot ? 'Edit Plot' : 'Add New Plot'}</DialogTitle>
            <DialogDescription>
              {editingPlot ? 'Update the details of the plot.' : 'Enter the details for the new plot.'}
            </DialogDescription>
          </DialogHeader>
          <PlotForm plot={editingPlot} locations={locations} closeDialog={closePlotDialog} />
        </DialogContent>
      </Dialog>

      {/* Delete Plot Confirmation */}
      <Dialog open={deletePlotId != null} onOpenChange={(open) => { if (!open) setDeletePlotId(null); }}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Delete plot?</DialogTitle>
            <DialogDescription>
              This will permanently delete the plot and all associated beds. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button variant="destructive" onClick={confirmDeletePlot} disabled={isDeletingPlot} aria-disabled={isDeletingPlot}>
              {isDeletingPlot ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isBedDialogOpen} onOpenChange={setIsBedDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{editingBed ? 'Edit Bed' : `Add New Bed to ${currentPlotForBed?.name ?? 'Plot'}`}</DialogTitle>
            <DialogDescription>
              {editingBed ? 'Update the details of the bed.' : 'Enter the details for the new bed.'}
            </DialogDescription>
          </DialogHeader>
          <BedForm bed={editingBed} plots={allPlots} closeDialog={closeBedDialog} />
        </DialogContent>
      </Dialog>

      {/* Delete Bed Confirmation */}
      <Dialog open={deleteBedId != null} onOpenChange={(open) => { if (!open) setDeleteBedId(null); }}>
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
            <Button variant="destructive" onClick={confirmDeleteBed} disabled={isDeletingBed} aria-disabled={isDeletingBed}>
              {isDeletingBed ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="space-y-8">
        {plotsWithBeds.length === 0 ? (
          <p className="text-center text-gray-500">No plots found. Add a plot to get started.</p>
        ) : (
          Object.entries(plotsByLocation).map(([locationKey, locationData]) =>
            renderLocationSection(locationKey, locationData)
          )
        )}
      </div>
    </div>
  );
}


function LocationWeather({ id, latitude, longitude }: { id: string; latitude: number | null; longitude: number | null }) {
  const [state, setState] = useState<
    | { status: 'idle' }
    | { status: 'loading' }
    | { status: 'error'; message: string }
    | {
        status: 'ready'
        data: {
          timezone: string
          current: {
            dt: number
            sunrise?: number
            sunset?: number
            temp: number
            humidity: number
            weather: { id: number; main: string; description: string; icon: string } | null
          }
          moonPhase?: number
          moonPhaseLabel?: string
        }
      }
  >({ status: 'idle' })

  useEffect(() => {
    if (latitude == null || longitude == null) return
    let cancelled = false
    setState({ status: 'loading' })
    fetch(`/api/locations/${id}/weather`, { cache: 'no-store' })
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.json()).error || res.statusText)
        return res.json()
      })
      .then((data) => {
        if (cancelled) return
        setState({ status: 'ready', data })
      })
      .catch((e) => {
        if (cancelled) return
        setState({ status: 'error', message: e instanceof Error ? e.message : 'Failed to load weather' })
      })
    return () => {
      cancelled = true
    }
  }, [id, latitude, longitude])

  if (latitude == null || longitude == null) {
    return <span className="text-muted-foreground text-sm">Set coordinates to enable weather</span>
  }
  if (state.status === 'loading' || state.status === 'idle') {
    return <span className="text-muted-foreground text-sm">Loading weather…</span>
  }
  if (state.status === 'error') {
    return <span className="text-red-500 text-sm">{state.message}</span>
  }

  const { current } = state.data
  const tempF = current.temp

  return (
    <div className="flex items-center gap-4 text-sm">
      <WeatherBadge
        icon={current.weather?.icon}
        tempF={tempF}
        description={current.weather?.description || null}
        inlineDescription={false}
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
      {state.data.moonPhaseLabel && (
        <span className="inline-flex items-center gap-1 text-muted-foreground">
          <Moon className="h-3 w-3" /> {state.data.moonPhaseLabel}
        </span>
      )}
      {typeof current.humidity === 'number' && (
        <span className="inline-flex items-center gap-1 text-muted-foreground">
          <Droplet className="h-3 w-3" /> {current.humidity}%
        </span>
      )}
    </div>
  )
}

function formatUnixToLocalTime(unixSeconds: number) {
  try {
    const d = new Date(unixSeconds * 1000)
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  } catch {
    return ''
  }
}

// formatMoonPhase now imported from utils

