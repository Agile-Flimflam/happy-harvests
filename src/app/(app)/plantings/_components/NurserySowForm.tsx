'use client';

import { startTransition, useEffect } from 'react';
import { useActionState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { NurserySowSchema, type NurserySowInput } from '@/lib/validation/plantings/nursery-sow';
import { actionNurserySow, type PlantingFormState } from '../_actions';
import { toast } from 'sonner';
import { z } from 'zod';
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
type Nursery = { id: string; name: string };

interface Props {
  cropVarieties: Variety[];
  nurseries: Nursery[];
  closeDialog: () => void;
  formId?: string;
}

export function NurserySowForm({ cropVarieties, nurseries, closeDialog, formId }: Props) {
  const initial: PlantingFormState = { message: '', errors: {}, planting: null };
  const [state, formAction] = useActionState(actionNurserySow, initial);

  const form = useForm<z.input<typeof NurserySowSchema>>({
    resolver: zodResolver(NurserySowSchema),
    mode: 'onSubmit',
    defaultValues: {
      crop_variety_id: undefined,
      qty_initial: undefined,
      nursery_id: '',
      event_date: '',
      notes: '',
    },
  });

  useEffect(() => {
    if (!state.message) return;
    // Map errors into RHF and show toast
    if (state.errors && Object.keys(state.errors).length > 0) {
      Object.entries(state.errors).forEach(([field, errors]) => {
        const msg = Array.isArray(errors) ? errors[0] : (errors as unknown as string) || 'Invalid value';
        form.setError(field as keyof NurserySowInput, { message: msg });
      });
      toast.error(state.message);
    } else {
      toast.success(state.message);
      closeDialog();
    }
  }, [state, form, closeDialog]);

  const onSubmit = (values: z.input<typeof NurserySowSchema>) => {
    const parsed: NurserySowInput = NurserySowSchema.parse(values);
    const fd = new FormData();
    fd.append('crop_variety_id', String(parsed.crop_variety_id));
    fd.append('qty_initial', String(parsed.qty_initial));
    fd.append('nursery_id', String(parsed.nursery_id));
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
          name="nursery_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nursery</FormLabel>
              <FormControl>
                <Select value={field.value ? String(field.value) : ''} onValueChange={(v) => field.onChange(v)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select a nursery" />
                  </SelectTrigger>
                  <SelectContent>
                    {nurseries.map((n) => (
                      <SelectItem key={n.id} value={n.id}>{n.name}</SelectItem>
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


