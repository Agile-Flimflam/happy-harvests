'use client';

import { startTransition, useEffect } from 'react';
import { useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { HarvestSchema, type HarvestInput } from '@/lib/validation/plantings/harvest';
import { actionHarvest, type PlantingFormState } from '../_actions';
import { toast } from 'sonner';
import { z } from 'zod';
import { Input } from '@/components/ui/input';
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
  defaultQty?: number | null;
  defaultWeight?: number | null;
}

export default function HarvestForm({
  plantingId,
  closeDialog,
  formId,
  defaultQty,
  defaultWeight,
}: Props) {
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
  } = useRetryableActionState(actionHarvest, initial);

  const form = useForm<z.output<typeof HarvestSchema>>({
    resolver: zodResolver(HarvestSchema) as Resolver<z.output<typeof HarvestSchema>>,
    mode: 'onSubmit',
    defaultValues: {
      planting_id: plantingId,
      event_date: new Date().toISOString().slice(0, 10),
      qty_harvested: defaultQty ?? undefined,
      weight_grams: defaultWeight ?? undefined,
    },
  });

  useEffect(() => {
    if (!state?.message) return;
    if (!state.ok) {
      const fieldErrors = state.fieldErrors ?? {};
      Object.entries(fieldErrors).forEach(([field, errors]) => {
        const msg = Array.isArray(errors) ? errors[0] : String(errors);
        form.setError(field as keyof HarvestInput, { message: msg });
      });
      toast.error(state.message);
      return;
    }
    toast.success(state.message);
    closeDialog();
  }, [state, form, closeDialog]);

  const onSubmit = (values: HarvestInput) => {
    const fd = new FormData();
    fd.append('planting_id', String(values.planting_id));
    fd.append('event_date', values.event_date);
    if (values.qty_harvested != null) fd.append('qty_harvested', String(values.qty_harvested));
    if (values.weight_grams != null) fd.append('weight_grams', String(values.weight_grams));
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

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <FormField
            control={form.control}
            name="qty_harvested"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Quantity</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    min={1}
                    step={1}
                    className="mt-1"
                    value={field.value != null ? String(field.value) : ''}
                    onKeyDown={(e) => {
                      if (['e', 'E', '+', '-', '.'].includes(e.key)) {
                        e.preventDefault();
                      }
                    }}
                    onChange={(e) => {
                      const digits = e.target.value.replace(/[^0-9]/g, '');
                      field.onChange(digits === '' ? undefined : Number(digits));
                    }}
                    onWheel={(e) => (e.currentTarget as HTMLInputElement).blur()}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="weight_grams"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Weight (g)</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    min={1}
                    step={1}
                    className="mt-1"
                    value={field.value != null ? String(field.value) : ''}
                    onKeyDown={(e) => {
                      if (['e', 'E', '+', '-', '.'].includes(e.key)) {
                        e.preventDefault();
                      }
                    }}
                    onChange={(e) => {
                      const digits = e.target.value.replace(/[^0-9]/g, '');
                      field.onChange(digits === '' ? undefined : Number(digits));
                    }}
                    onWheel={(e) => (e.currentTarget as HTMLInputElement).blur()}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      </form>
    </Form>
  );
}
