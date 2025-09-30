'use client';

import { startTransition, useEffect } from 'react';
import { useActionState } from 'react';
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

interface Props {
  plantingId: number;
  closeDialog: () => void;
  formId?: string;
}

export default function HarvestForm({ plantingId, closeDialog, formId }: Props) {
  const initial: PlantingFormState = { message: '', errors: {}, planting: null };
  const [state, formAction] = useActionState(actionHarvest, initial);

  const form = useForm<z.input<typeof HarvestSchema>>({
    resolver: zodResolver(HarvestSchema) as Resolver<z.input<typeof HarvestSchema>>,
    mode: 'onSubmit',
    defaultValues: {
      planting_id: plantingId,
      event_date: new Date().toISOString().slice(0, 10),
      qty_harvested: undefined,
      weight_grams: undefined,
      quantity_unit: '',
    },
  });

  useEffect(() => {
    if (!state.message) return;
    if (state.errors && Object.keys(state.errors).length > 0) {
      Object.entries(state.errors).forEach(([field, errors]) => {
        const msg = Array.isArray(errors) ? errors[0] : (errors as unknown as string) || 'Invalid value';
        form.setError(field as keyof HarvestInput, { message: msg });
      });
      toast.error(state.message);
    } else {
      toast.success(state.message);
      closeDialog();
    }
  }, [state, form, closeDialog]);

  const onSubmit = (values: unknown) => {
    const parsed: HarvestInput = HarvestSchema.parse(values);
    const fd = new FormData();
    fd.append('planting_id', String(parsed.planting_id));
    fd.append('event_date', parsed.event_date);
    if (parsed.qty_harvested != null) fd.append('qty_harvested', String(parsed.qty_harvested));
    if (parsed.weight_grams != null) fd.append('weight_grams', String(parsed.weight_grams));
    if (parsed.quantity_unit) fd.append('quantity_unit', parsed.quantity_unit);
    startTransition(() => formAction(fd));
  };

  return (
    <Form {...form}>
      <form id={formId} onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-4">
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
                        e.preventDefault()
                      }
                    }}
                    onChange={(e) => {
                      const digits = e.target.value.replace(/[^0-9]/g, '')
                      field.onChange(digits === '' ? '' : Number(digits))
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
            name="quantity_unit"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Unit</FormLabel>
                <FormControl>
                  <Input className="mt-1" value={field.value ?? ''} onChange={(e) => field.onChange(e.target.value)} />
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
                        e.preventDefault()
                      }
                    }}
                    onChange={(e) => {
                      const digits = e.target.value.replace(/[^0-9]/g, '')
                      field.onChange(digits === '' ? '' : Number(digits))
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
