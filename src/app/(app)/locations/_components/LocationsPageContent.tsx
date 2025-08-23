'use client';

import { useState, useEffect } from 'react';
import { WeatherBadge } from '@/components/weather/WeatherBadge';
import type { Tables } from '@/lib/supabase-server';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { LocationForm } from './LocationForm';
import { deleteLocation } from '../_actions';
import { toast } from 'sonner';
import { MapPin, Pencil, Trash2, PlusCircle, Sunrise, Sunset, Moon } from 'lucide-react';

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
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold flex items-center gap-2"><MapPin className="h-6 w-6" /> Locations</h1>
        <Button onClick={handleAdd} size="sm">
          <PlusCircle className="h-4 w-4 mr-2" />
          Add Location
        </Button>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[540px]">
          <DialogHeader>
            <DialogTitle>{editingLocation ? 'Edit Location' : 'Add New Location'}</DialogTitle>
            <DialogDescription>
              {editingLocation ? 'Update the details of the location.' : 'Enter the details for the new location.'}
            </DialogDescription>
          </DialogHeader>
          <LocationForm location={editingLocation} closeDialog={closeDialog} />
        </DialogContent>
      </Dialog>

      <div className="space-y-6">
        <Card>
          <CardHeader className="pb-4">
            <CardTitle>All Locations</CardTitle>
          </CardHeader>
          <CardContent>
            {locations.length === 0 ? (
              <p className="text-center text-gray-500">No locations found. Add one to get started.</p>
            ) : (
              <div className="border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Address</TableHead>
                      <TableHead>Coordinates</TableHead>
                      <TableHead>Weather</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {locations.map((loc) => (
                      <TableRow key={loc.id}>
                        <TableCell className="font-medium">{loc.name}</TableCell>
                        <TableCell>
                          {(() => {
                            const street = loc.street ?? ''
                            const cityState = [loc.city, loc.state].filter(Boolean).join(', ')
                            const cityStateZip = [cityState, loc.zip ?? ''].filter(Boolean).join(' ')
                            const full = [street, cityStateZip].filter(Boolean).join(', ')
                            return full || '-'
                          })()}
                        </TableCell>
                        <TableCell>
                          {loc.latitude != null && loc.longitude != null ? `${loc.latitude.toFixed(6)}, ${loc.longitude.toFixed(6)}` : '-'}
                        </TableCell>
                        <TableCell>
                          <WeatherCell
                            id={loc.id}
                            latitude={loc.latitude}
                            longitude={loc.longitude}
                          />
                        </TableCell>
                        <TableCell className="text-right">
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
          </CardContent>
        </Card>
      </div>
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
        {state.data.moonPhaseLabel && (
          <span className="inline-flex items-center gap-1">
            <Moon className="h-3 w-3" /> {state.data.moonPhaseLabel}
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

// formatMoonPhase now imported from utils
