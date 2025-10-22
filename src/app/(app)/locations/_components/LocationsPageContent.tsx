'use client';

import { useState, useEffect } from 'react';
import { WeatherBadge } from '@/components/weather/WeatherBadge';
import type { Tables } from '@/lib/supabase-server';
import { Button } from '@/components/ui/button';
import PageHeader from '@/components/page-header';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import PageContent from '@/components/page-content';
// Dialog header/footer handled by FormDialog
import FormDialog from '@/components/dialogs/FormDialog';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { LocationForm } from './LocationForm';
import { deleteLocation } from '../_actions';
import { toast } from 'sonner';
import { Pencil, Trash2, PlusCircle, Sunrise, Sunset, Moon, Droplet } from 'lucide-react';

type Location = Tables<'locations'>;

interface LocationsPageContentProps {
  locations: Location[];
}

export function LocationsPageContent({ locations }: LocationsPageContentProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<Location | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

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
    <div>
      <PageHeader
        title="Locations"
        action={(
          <Button onClick={handleAdd} size="sm" className="w-full sm:w-auto">
            <PlusCircle className="h-4 w-4 mr-2" />
            Add Location
          </Button>
        )}
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
        {locations.length === 0 ? (
          <p className="text-center text-gray-500">No locations found. Add one to get started.</p>
        ) : (
          <div className="border rounded-md overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="font-semibold whitespace-normal">Name</TableHead>
                  <TableHead className="font-semibold whitespace-normal">Address</TableHead>
                  <TableHead className="font-semibold whitespace-normal">Coordinates</TableHead>
                  <TableHead className="font-semibold whitespace-normal">Weather</TableHead>
                  <TableHead className="text-right font-semibold whitespace-normal">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {locations.map((loc) => (
                  <TableRow key={loc.id}>
                    <TableCell className="font-medium whitespace-normal break-words">{loc.name}</TableCell>
                    <TableCell className="whitespace-normal break-words">
                      {(() => {
                        const street = loc.street ?? ''
                        const cityState = [loc.city, loc.state].filter(Boolean).join(', ')
                        const cityStateZip = [cityState, loc.zip ?? ''].filter(Boolean).join(' ')
                        const full = [street, cityStateZip].filter(Boolean).join(', ')
                        return full || '-'
                      })()}
                    </TableCell>
                    <TableCell className="whitespace-normal">
                      {loc.latitude != null && loc.longitude != null ? `${loc.latitude.toFixed(6)}, ${loc.longitude.toFixed(6)}` : '-'}
                    </TableCell>
                    <TableCell className="whitespace-normal break-words">
                      <WeatherCell
                        id={loc.id}
                        latitude={loc.latitude}
                        longitude={loc.longitude}
                      />
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(loc)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => openDelete(loc.id)} className="text-red-500 hover:text-red-700">
                        <Trash2 className="h-4 w-4" />
                      </Button>
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
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </PageContent>
    </div>
  );
}


function WeatherCell({ id, latitude, longitude }: { id: string; latitude: number | null; longitude: number | null }) {
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
    return <span className="text-muted-foreground text-sm">Loading…</span>
  }
  if (state.status === 'error') {
    return <span className="text-red-500 text-sm">{state.message}</span>
  }

  const { current } = state.data
  const tempF = current.temp

  return (
    <div className="flex flex-col gap-1">
      <WeatherBadge
        icon={current.weather?.icon}
        tempF={tempF}
        description={current.weather?.description || null}
        inlineDescription
        size="sm"
        hawaiianMoon={state.data.moonPhaseLabel}
      />
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        {typeof current.sunrise === 'number' && (
          <span className="inline-flex items-center gap-1">
            <Sunrise className="h-3 w-3" /> {formatUnixToLocalTime(current.sunrise)}
          </span>
        )}
        {typeof current.sunset === 'number' && (
          <span className="inline-flex items-center gap-1">
            <Sunset className="h-3 w-3" /> {formatUnixToLocalTime(current.sunset)}
          </span>
        )}
        {/* Moon phase shown inline via WeatherBadge tooltip */}
        {typeof current.humidity === 'number' && (
          <span className="inline-flex items-center gap-1">
            <Droplet className="h-3 w-3" /> {current.humidity}%
          </span>
        )}
      </div>
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
