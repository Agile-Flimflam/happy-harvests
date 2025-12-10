'use client';

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Pencil, Trash2, Sunrise, Sunset, Droplet, MapPin, Plus, Building2 } from 'lucide-react';

import { WeatherBadge } from '@/components/weather/WeatherBadge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { FlowShell, OneHandGrid } from '@/components/ui/flow-shell';
import { InlineCreateSheet } from '@/components/ui/inline-create-sheet';
import {
  EntitySummaryCard,
  type EntityMetaItem,
  type EntityTag,
} from '@/components/ui/entity-summary-card';
import { RecentChips } from '@/components/ui/recent-chips';
import { StateBlock } from '@/components/ui/state-block';
import { StickyActionBar } from '@/components/ui/sticky-action-bar';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

import type { Tables } from '@/lib/supabase-server';
import { LocationForm } from './LocationForm';
import { deleteLocation, type DeleteLocationResult } from '../_actions';
import type { WeatherSnapshot } from '../actions';

type Location = Tables<'locations'>;

interface LocationsPageContentProps {
  locations: Location[];
  weatherByLocation?: Record<string, WeatherSnapshot>;
}

export function LocationsPageContent({
  locations,
  weatherByLocation = {},
}: LocationsPageContentProps) {
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<Location | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);
  const hasLocations = locations.length > 0;
  const safeLocations = useMemo(
    () =>
      selectedLocationId ? locations.filter((loc) => loc.id === selectedLocationId) : locations,
    [locations, selectedLocationId]
  );
  const recentChips = useMemo(
    () =>
      locations.slice(0, 6).map((loc) => ({
        label: loc.name ?? 'Unnamed location',
        value: loc.id,
      })),
    [locations]
  );

  const handleAdd = () => {
    setEditingLocation(null);
    setIsSheetOpen(true);
  };

  const handleEdit = (loc: Location) => {
    setEditingLocation(loc);
    setIsSheetOpen(true);
  };

  const openDelete = (id: string) => setDeleteId(id);
  const confirmDelete = async () => {
    if (deleteId == null) return;
    try {
      setDeleting(true);
      const result: DeleteLocationResult = await deleteLocation(deleteId);
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
    setIsSheetOpen(false);
    setEditingLocation(null);
  };

  const deletingLocation = deleteId ? locations.find((loc) => loc.id === deleteId) : null;
  const confirmDescription = deletingLocation
    ? `${deletingLocation.name ?? 'This location'} must have any associated plots reassigned or deleted before removing it.`
    : 'You must reassign or delete associated plots first.';

  return (
    <>
      <FlowShell
        title="Locations"
        description="Mobile-first summaries with quick weather context."
        icon={<Building2 className="h-5 w-5" aria-hidden />}
      >
        <InlineCreateSheet
          open={isSheetOpen}
          onOpenChange={setIsSheetOpen}
          title={editingLocation ? 'Edit Location' : 'Add New Location'}
          description={
            editingLocation
              ? 'Update the details of the location.'
              : 'Enter the details for the new location.'
          }
          primaryAction={{
            label: editingLocation ? 'Update Location' : 'Create Location',
            formId: 'locationFormSubmit',
          }}
          secondaryAction={{
            label: 'Cancel',
            onClick: closeDialog,
          }}
          footerContent="Sheets respect safe areas for thumbs and keyboards."
        >
          <LocationForm
            location={editingLocation}
            closeDialog={closeDialog}
            formId="locationFormSubmit"
          />
        </InlineCreateSheet>

        <div className="space-y-4">
          {recentChips.length > 1 ? (
            <RecentChips
              items={recentChips}
              activeValue={selectedLocationId}
              onSelect={setSelectedLocationId}
              ariaLabel="Filter locations"
              clearLabel="Clear filter"
            />
          ) : null}

          {!hasLocations ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <MapPin className="size-10" aria-hidden />
                </EmptyMedia>
                <EmptyTitle>No locations yet</EmptyTitle>
                <EmptyDescription>Add your farm, field, or garden to get started.</EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button onClick={handleAdd}>
                  <span className="flex items-center gap-1">
                    <Plus className="w-4 h-4" aria-hidden />
                    Add Location
                  </span>
                </Button>
              </EmptyContent>
            </Empty>
          ) : (
            <OneHandGrid columns={2}>
              {safeLocations.map((loc) => {
                const street = loc.street ?? '';
                const cityState = [loc.city, loc.state].filter(Boolean).join(', ');
                const cityStateZip = [cityState, loc.zip ?? ''].filter(Boolean).join(' ');
                const addressInline = [street, cityStateZip].filter(Boolean).join(', ');
                const locationName = loc.name ?? 'Unnamed Location';
                const weather = weatherByLocation[loc.id];
                const meta: EntityMetaItem[] = [
                  {
                    label: 'Address',
                    value: addressInline || 'Address not provided',
                    icon: <MapPin className="h-4 w-4" aria-hidden />,
                  },
                  {
                    label: 'Weather',
                    value: <WeatherCell locationName={locationName} weather={weather} />,
                    icon: <Sunrise className="h-4 w-4" aria-hidden />,
                  },
                ];
                const tags: EntityTag[] = [
                  {
                    label: loc.timezone ?? 'Timezone pending',
                    tone: loc.timezone ? 'info' : 'warn',
                  },
                ];

                return (
                  <EntitySummaryCard
                    key={loc.id}
                    title={locationName}
                    description={loc.notes ?? undefined}
                    meta={meta}
                    tags={tags}
                    icon={<MapPin className="h-5 w-5" aria-hidden />}
                    footer={
                      addressInline ? null : (
                        <StateBlock
                          title="Add an address"
                          description="Include coordinates to unlock weather."
                          className="w-full"
                          action={
                            <Button
                              variant="link"
                              size="sm"
                              className="px-0"
                              onClick={() => handleEdit(loc)}
                            >
                              Edit location
                            </Button>
                          }
                        />
                      )
                    }
                    actions={
                      <div className="flex items-center gap-1">
                        <Button
                          aria-label={`Edit ${locationName}`}
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(loc)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          aria-label={`Delete ${locationName}`}
                          variant="ghost"
                          size="icon"
                          onClick={() => openDelete(loc.id)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    }
                  />
                );
              })}
            </OneHandGrid>
          )}
        </div>

        <ConfirmDialog
          open={deleteId != null}
          onOpenChange={(open) => {
            if (!open) setDeleteId(null);
          }}
          title="Delete location?"
          description={confirmDescription}
          confirmText="Delete"
          confirmVariant="destructive"
          confirming={deleting}
          onConfirm={confirmDelete}
        />
      </FlowShell>

      {hasLocations ? (
        <StickyActionBar aria-label="Quick add location" align="end" position="fixed">
          <Button onClick={handleAdd} className="w-full sm:w-auto">
            <Plus className="h-4 w-4 mr-2" aria-hidden />
            Add Location
          </Button>
        </StickyActionBar>
      ) : null}
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
  );
}

function WeatherCell({
  locationName,
  weather,
}: {
  locationName: string;
  weather?: WeatherSnapshot;
}) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  if (!weather) {
    return <span className="text-muted-foreground text-sm">Set coordinates to enable weather</span>;
  }

  const { current } = weather;
  const tempF = current.temp;

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
            hawaiianMoon={weather.moonPhaseLabel}
            withTooltipProvider={false}
            showWeatherTooltip
          />
          {typeof current.humidity === 'number' && (
            <HumidityDisplay
              value={current.humidity}
              className="text-muted-foreground text-sm shrink-0"
            />
          )}
          <Button
            aria-label={`View weather details for ${locationName}`}
            variant="link"
            size="sm"
            className="px-0 h-auto shrink-0"
            onClick={() => setDetailsOpen(true)}
          >
            Details
          </Button>
        </div>
        <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Weather details</DialogTitle>
              <DialogDescription>Local conditions and solar times</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <WeatherBadge
                icon={current.weather?.icon}
                tempF={tempF}
                description={current.weather?.description || null}
                inlineDescription
                size="md"
                hawaiianMoon={weather.moonPhaseLabel}
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
