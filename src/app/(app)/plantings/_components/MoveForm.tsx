'use client';

import { startTransition, useEffect } from 'react';
import { useActionState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { MoveSchema, type MoveInput } from '@/lib/validation/plantings/move';
import { actionMove, type PlantingFormState } from '../_actions';
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

export default function MoveForm({ plantingId, beds, closeDialog, formId }: Props) {
  const initial: PlantingFormState = { message: '', errors: {}, planting: null };
  const [state, formAction] = useActionState(actionMove, initial);

  const form = useForm<z.input<typeof MoveSchema>>({
    resolver: zodResolver(MoveSchema),
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
        form.setError(field as keyof MoveInput, { message: msg });
      });
      toast.error(state.message);
    } else {
      toast.success(state.message);
      closeDialog();
    }
  }, [state, form, closeDialog]);

  const onSubmit = (values: z.input<typeof MoveSchema>) => {
    const parsed: MoveInput = MoveSchema.parse(values);
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
              <FormLabel>New Bed</FormLabel>
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
