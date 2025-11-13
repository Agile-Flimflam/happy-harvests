'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Pencil, Trash2, Sunrise, Sunset, Droplet, MapPin, Plus } from 'lucide-react';

import PageHeader from '@/components/page-header';
import PageContent from '@/components/page-content';
import { WeatherBadge } from '@/components/weather/WeatherBadge';
// Dialog header/footer handled by FormDialog
import FormDialog from '@/components/dialogs/FormDialog';

// UI components
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardFooter, CardHeader } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

import type { Tables } from '@/lib/supabase-server';
import { LocationForm } from './LocationForm';
import { deleteLocation } from '../_actions';

type Location = Tables<'locations'>;

interface LocationsPageContentProps {
  locations: Location[];
}

export function LocationsPageContent({ locations }: LocationsPageContentProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<Location | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const hasLocations = locations.length > 0;

  const handleAdd = () => {
    setEditingLocation(null);
    setIsDialogOpen(true);
  };

  const handleEdit = (loc: Location) => {
    setEditingLocation(loc);
    setIsDialogOpen(true);
  };

  const openDelete = (id: string) => setDeleteId(id);
  const confirmDelete = async () => {
    if (deleteId == null) return;
    try {
      setDeleting(true);
      const result = await deleteLocation(deleteId);
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

  const closeDialog = () => {
    setIsDialogOpen(false);
    setEditingLocation(null);
  };

  return (
    <>
      <PageHeader
        title="Locations"
        action={hasLocations ? (
          <Button onClick={handleAdd} size="sm" className="w-full sm:w-auto">
            <Plus className="h-4 w-4 mr-2" />
            Add Location
          </Button>
        ) : undefined}
      />

      <FormDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        title={editingLocation ? 'Edit Location' : 'Add New Location'}
        description={editingLocation ? 'Update the details of the location.' : 'Enter the details for the new location.'}
        submitLabel={editingLocation ? 'Update Location' : 'Create Location'}
        formId="locationFormSubmit"
        className="sm:max-w-[540px]"
      >
        <LocationForm location={editingLocation} closeDialog={closeDialog} formId="locationFormSubmit" />
      </FormDialog>

      <PageContent>
        {!hasLocations ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <MapPin className="size-10" />
              </EmptyMedia>
              <EmptyTitle>No locations yet</EmptyTitle>
              <EmptyDescription>
                Add your farm, field, or garden to get started.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button onClick={handleAdd}>
                <span className="flex items-center gap-1">
                  <Plus className="w-4 h-4" />
                  Add Location
                </span>
              </Button>
            </EmptyContent>
          </Empty>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {locations.map((loc) => {
              const street = loc.street ?? ''
              const cityState = [loc.city, loc.state].filter(Boolean).join(', ')
              const cityStateZip = [cityState, loc.zip ?? ''].filter(Boolean).join(' ')
              const addressInline = [street, cityStateZip].filter(Boolean).join(', ')
              const locationName = loc.name ?? 'Unnamed Location'
              return (
                <Card key={loc.id} className="flex flex-col h-full overflow-hidden">
                  <CardHeader className="flex w-full flex-row items-start justify-between gap-3 overflow-hidden">
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <h3 className="text-lg sm:text-xl font-semibold tracking-tight leading-snug break-words">{locationName}</h3>
                      <CardDescription>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground min-w-0">
                              <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
                              <span className="truncate">{addressInline || 'Address not provided'}</span>
                            </div>
                          </TooltipTrigger>
                          {addressInline ? <TooltipContent>{addressInline}</TooltipContent> : null}
                        </Tooltip>
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-1 ml-2 shrink-0">
                      <Button aria-label={`Edit ${locationName}`} variant="ghost" size="icon" onClick={() => handleEdit(loc)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        aria-label={`Delete ${locationName}`}
                        variant="ghost"
                        size="icon"
                        onClick={() => openDelete(loc.id)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardFooter className="mt-auto">
                    <div className="w-full">
                      <WeatherCell id={loc.id} locationName={locationName} latitude={loc.latitude} longitude={loc.longitude} />
                    </div>
                  </CardFooter>
                </Card>
              )
            })}
          </div>
        )}
        <ConfirmDialog
          open={deleteId != null}
          onOpenChange={(open) => { if (!open) setDeleteId(null); }}
          title="Delete location?"
          description="You must reassign or delete associated plots first."
          confirmText="Delete"
          confirmVariant="destructive"
          confirming={deleting}
          onConfirm={confirmDelete}
        />
      </PageContent>
    </>
  );
}


function HumidityDisplay({ value, className }: { value: number; className?: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={cn('inline-flex items-center gap-1 cursor-help', className)}>
          <Droplet className="h-4 w-4" /> Humidity {value}%
        </span>
      </TooltipTrigger>
      <TooltipContent>Relative humidity</TooltipContent>
    </Tooltip>
  )
}

function WeatherCell({ id, locationName, latitude, longitude }: { id: string; locationName: string; latitude: number | null; longitude: number | null }) {
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
  const [detailsOpen, setDetailsOpen] = useState(false)

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
    return <span className="text-muted-foreground text-sm">Loading…</span>
  }
  if (state.status === 'error') {
    return <span className="text-red-500 text-sm">{state.message}</span>
  }

  const { current } = state.data
  const tempF = current.temp

  return (
    <TooltipProvider>
      <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 min-w-0">
        <WeatherBadge
          icon={current.weather?.icon}
          tempF={tempF}
          description={current.weather?.description || null}
          inlineDescription={false}
          size="sm"
          hawaiianMoon={state.data.moonPhaseLabel}
          withTooltipProvider={false}
          showWeatherTooltip
        />
        {typeof current.humidity === 'number' && (
          <HumidityDisplay value={current.humidity} className="text-muted-foreground text-sm shrink-0" />
        )}
        <Button aria-label={`View weather details for ${locationName}`} variant="link" size="sm" className="px-0 h-auto shrink-0" onClick={() => setDetailsOpen(true)}>
          Details
        </Button>
        </div>
        <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Weather details</DialogTitle>
            <DialogDescription>
              Local conditions and solar times
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <WeatherBadge
              icon={current.weather?.icon}
              tempF={tempF}
              description={current.weather?.description || null}
              inlineDescription
              size="md"
              hawaiianMoon={state.data.moonPhaseLabel}
              withTooltipProvider={false}
            />
            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              {typeof current.sunrise === 'number' && (
                <span className="inline-flex items-center gap-1">
                  <Sunrise className="h-4 w-4" /> Sunrise {formatUnixToLocalTime(current.sunrise)}
                </span>
              )}
              {typeof current.sunset === 'number' && (
                <span className="inline-flex items-center gap-1">
                  <Sunset className="h-4 w-4" /> Sunset {formatUnixToLocalTime(current.sunset)}
                </span>
              )}
              {typeof current.humidity === 'number' && (
                <HumidityDisplay value={current.humidity} />
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
      </div>
  </TooltipProvider>
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
