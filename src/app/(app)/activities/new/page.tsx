import { createActivity, getActivityFormOptions } from '../actions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ActivityForm } from '@/components/activities/ActivityForm';
import type { Tables } from '@/lib/database.types';

type LocationOption = Pick<Tables<'locations'>, 'id' | 'name'>;
type PlotOption = { plot_id: number; name: string; location_id: string };
type BedOption = { id: number; plot_id: number; name: string | null };
type NurseryOption = { id: string; name: string; location_id: string };

export default async function NewActivityPage({
  searchParams,
}: Readonly<{ searchParams?: Promise<{ start?: string }> }>) {
  const { locations, plots, beds, nurseries } = await getActivityFormOptions();
  const sp = searchParams ? await searchParams : undefined;
  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Track an Activity</h1>
      <Card>
        <CardHeader>
          <CardTitle>New Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <ActivityForm
            action={createActivity}
            locations={(locations ?? []) as LocationOption[]}
            plots={(plots ?? []) as PlotOption[]}
            beds={(beds ?? []) as BedOption[]}
            nurseries={(nurseries ?? []) as NurseryOption[]}
            defaultStart={sp?.start}
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
