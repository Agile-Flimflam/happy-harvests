import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { updateActivity, getActivityEditData } from '../../actions';
import { EditActivityContent } from '@/components/activities/EditActivityContent';
import { notFound } from 'next/navigation';
import { sanitizeErrorMessage } from '@/lib/sanitize';

export default async function EditActivityPage({
  params,
}: Readonly<{ params?: Promise<{ id: string }> }>) {
  const resolvedParams = params ? await params : undefined;
  const id = Number(resolvedParams?.id);
  if (!Number.isFinite(id)) return notFound();
  const { activity, locations, error } = await getActivityEditData(id);
  const updateActivityAction = async (formData: FormData): Promise<void> => {
    'use server';
    const result = await updateActivity(formData);
    const hasFieldErrors =
      result?.errors &&
      Object.values(result.errors).some((errs) => Array.isArray(errs) && errs.length > 0);
    const message = result?.message ?? '';
    const lowerMsg = message.toLowerCase();
    const looksLikeError =
      lowerMsg.startsWith('database error') || lowerMsg.includes('validation failed');
    const isSuccess = lowerMsg.includes('success');
    if (hasFieldErrors || looksLikeError || !isSuccess) {
      throw new Error(message || 'Activity update failed');
    }
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
