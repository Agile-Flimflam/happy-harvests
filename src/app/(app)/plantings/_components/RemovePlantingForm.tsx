'use client';

import { startTransition, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { RemoveSchema, type RemoveInput } from '@/lib/validation/plantings/remove';
import { actionRemove, undoRemovePlanting, type PlantingFormState } from '../_actions';
import { toast } from 'sonner';
import { z } from 'zod';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { ErrorPresenter } from '@/components/ui/error-presenter';
import { useRetryableActionState } from '@/hooks/use-retryable-action';

interface Props {
  plantingId: number;
  closeDialog: () => void;
  formId?: string;
}

export default function RemovePlantingForm({ plantingId, closeDialog, formId }: Props) {
  const initial: PlantingFormState = {
    ok: true,
    data: { planting: null, undoId: null },
    message: '',
    correlationId: 'init',
  };
  const {
    state,
    dispatch: formAction,
    retry,
    hasPayload,
  } = useRetryableActionState(actionRemove, initial);

  const form = useForm<z.input<typeof RemoveSchema>>({
    resolver: zodResolver(RemoveSchema),
    mode: 'onSubmit',
    defaultValues: {
      planting_id: plantingId,
      event_date: new Date().toISOString().slice(0, 10),
      reason: '',
    },
  });

  useEffect(() => {
    if (!state?.message) return;
    if (!state.ok) {
      const fieldErrors = state.fieldErrors ?? {};
      Object.entries(fieldErrors).forEach(([field, errors]) => {
        const msg = Array.isArray(errors) ? errors[0] : String(errors);
        form.setError(field as keyof RemoveInput, { message: msg });
      });
      toast.error(state.message);
      return;
    }
    const undoId = state.data?.undoId ?? null;
    toast.success(state.message, {
      action:
        undoId != null
          ? {
              label: 'Undo',
              onClick: () => {
                undoRemovePlanting(undoId).then((res) => {
                  if (!res.ok) {
                    toast.error(res.message);
                    return;
                  }
                  toast.success(res.message);
                });
              },
            }
          : undefined,
    });
    closeDialog();
  }, [state, form, closeDialog]);

  const onSubmit = (values: z.input<typeof RemoveSchema>) => {
    const parsed: RemoveInput = RemoveSchema.parse(values);
    const fd = new FormData();
    fd.append('planting_id', String(parsed.planting_id));
    fd.append('event_date', parsed.event_date);
    if (parsed.reason) fd.append('reason', parsed.reason);
    startTransition(() => formAction(fd));
  };

  const handleRetry = () => {
    if (!hasPayload) return;
    startTransition(() => retry());
  };

  return (
    <Form {...form}>
      <form id={formId} onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-4">
        {!state.ok ? (
          <ErrorPresenter
            message={state.message}
            correlationId={state.correlationId}
            details={state.details}
            onRetry={hasPayload ? handleRetry : undefined}
          />
        ) : null}
        <FormField
          control={form.control}
          name="event_date"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Date</FormLabel>
              <FormControl>
                <Input
                  type="date"
                  className="mt-1"
                  value={typeof field.value === 'string' ? field.value : ''}
                  onChange={(e) => field.onChange(e.target.value)}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="reason"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Reason (optional)</FormLabel>
              <FormControl>
                <Textarea
                  className="mt-1"
                  rows={3}
                  value={field.value ?? ''}
                  onChange={(e) => field.onChange(e.target.value)}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </form>
    </Form>
  );
}
