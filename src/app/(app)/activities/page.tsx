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
type SearchParams = Record<string, string | string[] | undefined>;

function normalizeActivityRows(
  rows: (Tables<'activities'> & { locations?: unknown })[] | undefined
): ActivityRow[] {
  if (!rows?.length) return [];
  return rows.map((row) => {
    const loc = row.locations;
    if (loc === undefined) return row as ActivityRow;
    if (loc === null) return { ...row, locations: null };
    if (typeof loc === 'object') {
      const name =
        typeof (loc as { name?: unknown }).name === 'string'
          ? (loc as { name: string }).name
          : null;
      return { ...row, locations: { name } };
    }
    // Fallback: coerce invalid shapes to null-safe structure
    return { ...row, locations: null };
  });
}

function firstParamValue(param?: string | string[]): string | undefined {
  if (typeof param === 'string') return param;
  if (Array.isArray(param)) return param[0];
  return undefined;
}

export default async function ActivitiesPage({
  searchParams,
}: Readonly<{ searchParams?: Promise<SearchParams> }>) {
  const { locations = [], error: locationsError } = await getActivityLocations();
  const sp = searchParams ? await searchParams : {};
  const typeParam = firstParamValue(sp.type);
  const type = isActivityType(typeParam) ? typeParam : undefined;
  const from = firstParamValue(sp.from);
  const to = firstParamValue(sp.to);
  const locationId = firstParamValue(sp.location_id);
  const { grouped, error } = await getActivitiesGrouped({
    type,
    from,
    to,
    location_id: locationId,
  });
  if (error) {
    return <div className="text-red-500">{error}</div>;
  }
  const groupedRows = Object.fromEntries(
    Object.entries(grouped ?? {}).map(([key, rows]) => [key, normalizeActivityRows(rows)])
  );

  const types: ActivityType[] = Object.keys(groupedRows || {})
    .filter(isActivityType)
    .sort((a, b) => prettyActivityType(a).localeCompare(prettyActivityType(b)));
  const allRows = Object.values(groupedRows || [])
    .flat()
    .sort((a, b) => (b.started_at || '').localeCompare(a.started_at || ''));
  const typeToCount = Object.fromEntries(
    types.map((t) => [t, (grouped?.[t] || []).length])
  ) as Record<ActivityType, number>;
  const { rows: flatRows = [], error: flatErr } = await getActivitiesFlat({
    type,
    from,
    to,
    location_id: locationId,
  });
  const normalizedFlatRows = normalizeActivityRows(flatRows);
  const exportParams = new URLSearchParams();
  if (type) exportParams.set('type', type);
  if (from) exportParams.set('from', from);
  if (to) exportParams.set('to', to);
  if (locationId) exportParams.set('location_id', locationId);
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
      {locationsError ? (
        <div className="mb-4 rounded-md border border-destructive/50 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {locationsError}
        </div>
      ) : null}
      <ActivitiesFilters
        locations={locations ?? []}
        initial={{
          type: type || '',
          location_id: locationId ?? '',
          from: from ?? '',
          to: to ?? '',
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
                      rows={normalizedFlatRows}
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
                    {allRows.map((a) => (
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
                      {(groupedRows?.[t] || []).map((a) => (
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
