import Link from 'next/link';
import {
  getActivitiesGrouped,
  getActivitiesFlat,
  deleteActivitiesBulk,
  getActivityLocations,
} from './actions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { Tables } from '@/lib/database.types';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ActivitiesTable } from '@/components/activities/ActivitiesTable';
import { Badge } from '@/components/ui/badge';
import { ActivitiesFilters } from '@/components/activities/ActivitiesFilters';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Download, Droplets, Plus } from 'lucide-react';
import { isActivityType, prettyActivityType, type ActivityType } from '@/lib/activities/types';
import { ActivityListItem } from '@/components/activities/ActivityListItem';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';

type ActivityRow = Tables<'activities'> & { locations?: { name?: string | null } | null };

export default async function ActivitiesPage({
  searchParams,
}: Readonly<{
  searchParams?: Promise<{ type?: string; from?: string; to?: string; location_id?: string }>;
}>) {
  const { locations = [] } = await getActivityLocations();
  const sp = searchParams ? await searchParams : undefined;
  const type = isActivityType(sp?.type) ? sp?.type : undefined;
  const { grouped, error } = await getActivitiesGrouped({
    type,
    from: sp?.from,
    to: sp?.to,
    location_id: sp?.location_id,
  });
  if (error) {
    return <div className="text-red-500">{error}</div>;
  }
  const types: ActivityType[] = Object.keys(grouped || {})
    .filter(isActivityType)
    .sort((a, b) => prettyActivityType(a).localeCompare(prettyActivityType(b)));
  const allRows = Object.values(grouped || {})
    .flat()
    .sort((a, b) => (b.started_at || '').localeCompare(a.started_at || ''));
  const typeToCount = Object.fromEntries(
    types.map((t) => [t, (grouped?.[t] || []).length])
  ) as Record<ActivityType, number>;
  const { rows: flatRows = [], error: flatErr } = await getActivitiesFlat({
    type,
    from: sp?.from,
    to: sp?.to,
    location_id: sp?.location_id,
  });
  const exportParams = new URLSearchParams();
  if (type) exportParams.set('type', type);
  if (sp?.from) exportParams.set('from', sp.from);
  if (sp?.to) exportParams.set('to', sp.to);
  if (sp?.location_id) exportParams.set('location_id', sp.location_id);
  const exportParamsString = exportParams.toString();
  const exportHref = exportParamsString
    ? `/api/activities/export?${exportParamsString}`
    : '/api/activities/export';
  const hasActivities = types.length > 0;
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Activities</h1>
        {hasActivities ? (
          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="icon" asChild>
                  <Link href={exportHref} aria-label="Export to CSV">
                    <Download className="h-4 w-4" />
                  </Link>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Export to CSV</TooltipContent>
            </Tooltip>
            <Button asChild size="sm">
              <Link href="/activities/new">Track an Activity</Link>
            </Button>
          </div>
        ) : null}
      </div>
      <ActivitiesFilters
        locations={(locations || []) as { id: string; name: string | null }[]}
        initial={{
          type: type || '',
          location_id: sp?.location_id ?? '',
          from: sp?.from ?? '',
          to: sp?.to ?? '',
        }}
      />
      <div>
        {hasActivities ? (
          <Tabs defaultValue="all">
            <TabsList>
              <TabsTrigger value="all">
                All{' '}
                <Badge className="ml-2" variant="secondary">
                  {allRows.length}
                </Badge>
              </TabsTrigger>
              {types.map((t) => (
                <TabsTrigger key={t} value={t}>
                  {prettyActivityType(t)}{' '}
                  <Badge className="ml-2" variant="secondary">
                    {typeToCount[t] || 0}
                  </Badge>
                </TabsTrigger>
              ))}
              <TabsTrigger value="table">Table</TabsTrigger>
            </TabsList>
            <TabsContent value="table">
              <Card>
                <CardHeader>
                  <CardTitle>All Activities (Table)</CardTitle>
                </CardHeader>
                <CardContent>
                  {flatErr ? (
                    <div className="text-red-500 text-sm">{flatErr}</div>
                  ) : (
                    <ActivitiesTable
                      rows={flatRows as ActivityRow[]}
                      bulkDeleteAction={deleteActivitiesBulk}
                    />
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="all">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">All Activities</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="divide-y">
                    {allRows.map((a: ActivityRow) => (
                      <ActivityListItem key={a.id} activity={a} showTypeBadge />
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </TabsContent>

            {types.map((t) => (
              <TabsContent key={t} value={t}>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base capitalize">{prettyActivityType(t)}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="divide-y">
                      {(grouped?.[t] || []).map((a: ActivityRow) => (
                        <ActivityListItem key={a.id} activity={a} showTypeBadge={false} />
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </TabsContent>
            ))}
          </Tabs>
        ) : (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Droplets className="size-10" />
              </EmptyMedia>
              <EmptyTitle>No activities yet</EmptyTitle>
              <EmptyDescription>Track your first activity to get started.</EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button asChild>
                <Link href="/activities/new">
                  <span className="flex items-center gap-1">
                    <Plus className="w-4 h-4" />
                    Track an Activity
                  </span>
                </Link>
              </Button>
            </EmptyContent>
          </Empty>
        )}
      </div>
    </div>
  );
}
