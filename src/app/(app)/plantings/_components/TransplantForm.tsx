'use client';

import { startTransition, useEffect } from 'react';
import { useActionState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { TransplantSchema, type TransplantInput } from '@/lib/validation/plantings/transplant';
import { actionTransplant, type PlantingFormState } from '../_actions';
import { toast } from 'sonner';
import { z } from 'zod';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';

type Bed = { id: number; length_inches: number | null; width_inches: number | null; plots?: { locations?: { name?: string | null } | null } | null };

interface Props {
  plantingId: number;
  beds: Bed[];
  closeDialog: () => void;
  formId?: string;
}

export default function TransplantForm({ plantingId, beds, closeDialog, formId }: Props) {
  const initial: PlantingFormState = { message: '', errors: {}, planting: null };
  const [state, formAction] = useActionState(actionTransplant, initial);

  const form = useForm<z.input<typeof TransplantSchema>>({
    resolver: zodResolver(TransplantSchema),
    mode: 'onSubmit',
    defaultValues: {
      planting_id: plantingId,
      bed_id: undefined,
      event_date: new Date().toISOString().slice(0, 10),
    },
  });

  useEffect(() => {
    if (!state.message) return;
    if (state.errors && Object.keys(state.errors).length > 0) {
      Object.entries(state.errors).forEach(([field, errors]) => {
        const msg = Array.isArray(errors) ? errors[0] : (errors as unknown as string) || 'Invalid value';
        form.setError(field as keyof TransplantInput, { message: msg });
      });
      toast.error(state.message);
    } else {
      toast.success(state.message);
      try {
        const vals = form.getValues();
        const eventDate = typeof vals.event_date === 'string' ? vals.event_date : undefined;
        const plantingIdVal = typeof vals.planting_id === 'number' ? vals.planting_id : plantingId;
        if (eventDate) {
          window.dispatchEvent(new CustomEvent('planting:transplanted', { detail: { plantingId: plantingIdVal, eventDate } }));
        }
      } catch (error) {
        // Log the error to aid debugging while keeping the UI flow unchanged.
        console.error('Failed to dispatch planting:transplanted event', error);
      }
      closeDialog();
    }
  }, [state, form, closeDialog, plantingId]);

  const onSubmit = (values: z.input<typeof TransplantSchema>) => {
    const parsed: TransplantInput = TransplantSchema.parse(values);
    const fd = new FormData();
    fd.append('planting_id', String(parsed.planting_id));
    fd.append('bed_id', String(parsed.bed_id));
    fd.append('event_date', parsed.event_date);
    startTransition(() => formAction(fd));
  };

  return (
    <Form {...form}>
      <form id={formId} onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-4">
        <FormField
          control={form.control}
          name="bed_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Bed</FormLabel>
              <FormControl>
                <Select value={field.value ? String(field.value) : ''} onValueChange={(v) => field.onChange(parseInt(v, 10))}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select a bed" />
                  </SelectTrigger>
                  <SelectContent>
                    {beds.map((b) => (
                      <SelectItem key={b.id} value={String(b.id)}>
                        Bed #{b.id} @ {b.plots?.locations?.name ?? 'Unknown'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

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
      </form>
    </Form>
  );
}
