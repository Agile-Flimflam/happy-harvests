import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { updateActivity, getActivityEditData } from '../../actions';
import { EditActivityContent } from '@/components/activities/EditActivityContent';
import { notFound } from 'next/navigation';

function sanitizeErrorMessage(message?: string): string {
  if (!message) return 'An unexpected error occurred';
  const replacements: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };
  return message.replace(/[&<>"']/g, (ch) => replacements[ch] || '');
}

export default async function EditActivityPage({
  params,
}: Readonly<{ params: Promise<{ id: string }> }>) {
  const resolvedParams = await params;
  const id = Number(resolvedParams?.id);
  if (!Number.isFinite(id)) return notFound();
  const { activity, locations, error } = await getActivityEditData(id);
  const updateActivityAction = async (formData: FormData) => {
    await updateActivity(formData);
  };
  if (error) {
    const safeError = sanitizeErrorMessage(error);
    return (
      <div className="text-red-500 text-sm" role="alert">
        {safeError}
      </div>
    );
  }
  if (!activity) return notFound();
  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Edit Activity</h1>
      <Card>
        <CardHeader>
          <CardTitle>Activity #{id}</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={updateActivityAction}>
            <input type="hidden" name="id" value={id} />
            <EditActivityContent activity={activity} locations={locations || []} />
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
