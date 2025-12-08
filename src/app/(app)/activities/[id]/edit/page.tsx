import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { updateActivity, getActivityEditData } from '../../actions';
import { EditActivityContent } from '@/components/activities/EditActivityContent';
import { notFound } from 'next/navigation';

export default async function EditActivityPage({
  params,
}: Readonly<{ params: Promise<{ id: string }> }>) {
  const { id: idParam } = await params;
  const id = Number(idParam);
  const { activity, locations } = await getActivityEditData(id);
  if (!activity) return notFound();
  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Edit Activity</h1>
      <Card>
        <CardHeader>
          <CardTitle>Activity #{id}</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={updateActivity}>
            <input type="hidden" name="id" value={id} />
            <EditActivityContent activity={activity} locations={locations || []} />
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
