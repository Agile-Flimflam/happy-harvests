'use client';

import { startTransition, useEffect } from 'react';
import { useActionState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { DirectSeedSchema, type DirectSeedInput } from '@/lib/validation/plantings/direct-seed';
import { z } from 'zod';
import { actionDirectSeed, type PlantingFormState } from '../_actions';
import { toast } from 'sonner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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

type Variety = { id: number; name: string; latin_name: string; crops?: { name: string } | null };
type Bed = { id: number; length_inches: number | null; width_inches: number | null; plots?: { locations?: { name?: string | null } | null } | null };

interface Props {
  cropVarieties: Variety[];
  beds: Bed[];
  closeDialog: () => void;
  formId?: string;
}

export function DirectSeedForm({ cropVarieties, beds, closeDialog, formId }: Props) {
  const initial: PlantingFormState = { message: '', errors: {}, planting: null };
  const [state, formAction] = useActionState(actionDirectSeed, initial);

  const form = useForm<z.input<typeof DirectSeedSchema>>({
    resolver: zodResolver(DirectSeedSchema),
    mode: 'onSubmit',
    defaultValues: {
      crop_variety_id: undefined,
      qty_initial: undefined,
      bed_id: undefined,
      event_date: '',
      notes: '',
    },
  });

  useEffect(() => {
    if (!state.message) return;
    if (state.errors && Object.keys(state.errors).length > 0) {
      Object.entries(state.errors).forEach(([field, errors]) => {
        const msg = Array.isArray(errors) ? errors[0] : (errors as unknown as string) || 'Invalid value';
        form.setError(field as keyof DirectSeedInput, { message: msg });
      });
      toast.error(state.message);
    } else {
      toast.success(state.message);
      closeDialog();
    }
  }, [state, form, closeDialog]);

  const onSubmit = (values: z.input<typeof DirectSeedSchema>) => {
    const parsed: DirectSeedInput = DirectSeedSchema.parse(values);
    const fd = new FormData();
    fd.append('crop_variety_id', String(parsed.crop_variety_id));
    fd.append('qty_initial', String(parsed.qty_initial));
    fd.append('bed_id', String(parsed.bed_id));
    fd.append('event_date', parsed.event_date);
    if (parsed.notes) fd.append('notes', parsed.notes);
    startTransition(() => formAction(fd));
  };

  return (
    <Form {...form}>
      <form id={formId} onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-4">
        <FormField
          control={form.control}
          name="crop_variety_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Plant Variety</FormLabel>
              <FormControl>
                <Select value={field.value ? String(field.value) : ''} onValueChange={(v) => field.onChange(parseInt(v, 10))}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select a variety" />
                  </SelectTrigger>
                  <SelectContent>
                    {cropVarieties.map((v) => (
                      <SelectItem key={v.id} value={String(v.id)}>{v.name}</SelectItem>
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
          name="qty_initial"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Quantity</FormLabel>
              <FormControl>
                <Input type="number" className="mt-1" value={field.value != null ? String(field.value) : ''} onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : '')} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

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
                        Bed #{b.id} ({b.length_inches ?? '?'}x{b.width_inches ?? '?'}) @ {b.plots?.locations?.name ?? 'Unknown'}
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
                <Input type="date" className="mt-1" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notes</FormLabel>
              <FormControl>
                <Textarea className="mt-1" rows={3} value={field.value ?? ''} onChange={(e) => field.onChange(e.target.value)} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </form>
    </Form>
  );
}


