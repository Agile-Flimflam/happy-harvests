import { createActivity, getActivityFormOptions } from '../actions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ActivityForm } from '@/components/activities/ActivityForm';

export default async function NewActivityPage({
  searchParams,
}: Readonly<{ searchParams?: Promise<Record<string, string | string[] | undefined>> }>) {
  const { locations, plots, beds, nurseries, error } = await getActivityFormOptions();
  const sp = searchParams ? await searchParams : undefined;
  const startParam = sp?.start;
  const defaultStart =
    typeof startParam === 'string'
      ? startParam
      : Array.isArray(startParam)
        ? startParam[0]
        : undefined;
  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Track an Activity</h1>
      <Card>
        <CardHeader>
          <CardTitle>New Activity</CardTitle>
        </CardHeader>
        <CardContent>
          {error ? (
            <div className="mb-4 rounded-md border border-destructive/50 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          ) : null}
          <ActivityForm
            action={createActivity}
            locations={locations ?? []}
            plots={plots ?? []}
            beds={beds ?? []}
            nurseries={nurseries ?? []}
            defaultStart={defaultStart}
          />
          <div className="mt-2 text-xs text-muted-foreground">
            Hawaiian moon phase for selected date is shown in weather tooltips wherever current
            weather is displayed.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
