'use client';

import { useEffect, useMemo, useState } from 'react';
import { getPlantingEvents } from '../_actions';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { FlaskConical, Leaf, ArrowRightLeft, Move, ShoppingBasket, Shovel } from 'lucide-react';
import { computePlantingSummary, formatPlantingEventType, type PlantingEventType } from '@/lib/plantings/utils';
import type { Enums } from '@/lib/supabase-server';
import { Badge } from '@/components/ui/badge';
import StatusBadge from '@/components/plantings/StatusBadge';
import PlantingSummaryCard from '@/components/labels/PlantingSummaryCard';

type EventItem = Awaited<ReturnType<typeof getPlantingEvents>>['events'] extends (infer U)[] | undefined ? U : never;

interface Props {
  plantingId: number;
  varietyName?: string | null;
  cropName?: string | null;
  status?: Enums<'planting_status'> | null;
  closeDialog: () => void;
}

function formatBed(ev: EventItem) {
  const b = ev.beds;
  if (!b) return 'Unknown';
  const loc = b.plots?.locations?.name ?? 'Unknown';
  return `Bed #${b.id} @ ${loc}`;
}

function formatDate(dateStr: string) {
  try {
    return new Date(dateStr).toLocaleDateString();
  } catch {
    return dateStr;
  }
}

export default function PlantingHistoryDialog({ plantingId, varietyName, cropName, status, closeDialog }: Props) {
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      const res = await getPlantingEvents(plantingId);
      if (!mounted) return;
      if (res.error) {
        setError(res.error);
      } else {
        setEvents(res.events ?? []);
      }
      setLoading(false);
    })();
    return () => { mounted = false; };
  }, [plantingId]);

  const headerTitle = useMemo(() => {
    const crop = cropName ? ` · ${cropName}` : '';
    return `${varietyName ?? 'Planting'}${crop}`;
  }, [varietyName, cropName]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">{headerTitle}</h3>
          <p className="text-sm text-muted-foreground">Event history</p>
        </div>
        {status ? <StatusBadge status={status} /> : null}
      </div>

      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : error ? (
        <div className="text-red-500">{error}</div>
      ) : events.length === 0 ? (
        <Card className="p-4 text-sm text-muted-foreground">No events yet.</Card>
      ) : (
        <>
          {(() => {
            const summary = computePlantingSummary({ events, status });
            const terminal = summary.endedDate ? events.find((e) => e.event_type === 'removed' || e.event_type === 'harvested') : undefined;
            const endLabel = terminal ? formatPlantingEventType(terminal.event_type as PlantingEventType) : undefined;
            return <PlantingSummaryCard summary={summary} endLabel={endLabel} />
          })()}
          <Tabs defaultValue="timeline" className="w-full">
          <TabsList>
            <TabsTrigger value="timeline">Timeline</TabsTrigger>
            <TabsTrigger value="table">Table</TabsTrigger>
          </TabsList>

          <TabsContent value="timeline" className="space-y-3">
            <div className="space-y-3">
              {events.map((ev) => {
                const date = formatDate(ev.event_date);
                let icon = null;
                let title = '';
                let details: string | null = null;
                switch (ev.event_type) {
                  case 'nursery_seeded':
                    icon = <FlaskConical className="h-4 w-4 text-green-600" />;
                    title = 'Nursery sowed';
                    details = ev.nurseries?.name ?? 'Nursery';
                    break;
                  case 'direct_seeded':
                    icon = <Leaf className="h-4 w-4 text-green-600" />;
                    title = 'Direct seeded';
                    details = formatBed(ev);
                    break;
                  case 'transplanted':
                    icon = <ArrowRightLeft className="h-4 w-4 text-blue-600" />;
                    title = 'Transplanted';
                    details = formatBed(ev);
                    break;
                  case 'moved':
                    icon = <Move className="h-4 w-4 text-blue-600" />;
                    title = 'Moved';
                    details = formatBed(ev);
                    break;
                  case 'harvested':
                    icon = <ShoppingBasket className="h-4 w-4 text-orange-600" />;
                    title = 'Harvest';
                    if (ev.qty_harvested != null && ev.quantity_unit) {
                      details = `${ev.qty_harvested} ${ev.quantity_unit}`;
                    } else if (ev.weight_grams != null) {
                      details = `${ev.weight_grams} g`;
                    } else {
                      details = null;
                    }
                    break;
                  case 'removed':
                    icon = <Shovel className="h-4 w-4 text-red-600" />;
                    title = 'Removed';
                    details = (ev.payload && (ev.payload as { reason?: string }).reason) || null;
                    break;
                  default:
                    title = ev.event_type;
                }
                return (
                  <Card key={ev.id} className="p-3">
                    <div className="flex items-center gap-3">
                      <div>{icon}</div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <div className="font-medium">{title}</div>
                          <div className="text-xs text-muted-foreground">{date}</div>
                        </div>
                        {details && <div className="text-sm text-muted-foreground">{details}</div>}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="table">
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Event</TableHead>
                    <TableHead>Bed/Nursery</TableHead>
                    <TableHead>Qty</TableHead>
                    <TableHead>Weight (g)</TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {events.map((ev) => (
                    <TableRow key={ev.id}>
                      <TableCell>{formatDate(ev.event_date)}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {formatPlantingEventType(ev.event_type as PlantingEventType)}
                        </Badge>
                      </TableCell>
                      <TableCell>{ev.event_type === 'nursery_seeded' ? (ev.nurseries?.name ?? 'Nursery') : (ev.event_type === 'direct_seeded' || ev.event_type === 'transplanted' || ev.event_type === 'moved') ? formatBed(ev) : '-'}</TableCell>
                      <TableCell>{ev.qty_harvested ?? '-'}</TableCell>
                      <TableCell>{ev.weight_grams ?? '-'}</TableCell>
                      <TableCell>{ev.quantity_unit ?? '-'}</TableCell>
                      <TableCell>{(ev.payload && (ev.payload as { reason?: string }).reason) ?? '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
            {/* Hidden form to enable FormDialog footer "Close" submit */}
            <form id="historyForm" onSubmit={(e) => { e.preventDefault(); closeDialog(); }} />
          </Tabs>
        </>
      )}
    </div>
  );
}
