'use client';

import { startTransition, useEffect, useRef, useState } from 'react';
import { useActionState } from 'react';
import { useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { NurserySowSchema, type NurserySowInput } from '@/lib/validation/plantings/nursery-sow';
import { actionNurserySow, type PlantingFormState } from '../_actions';
import { toast } from 'sonner';
import { z } from 'zod';
import { hawaiianMoonForISO, hawaiianMoonInfoForISO } from '@/lib/hawaiian-moon';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  defaultDate?: string | null;
  defaultNurseryId?: string | null;
  defaultVarietyId?: number | null;
}

export function NurserySowForm({
  cropVarieties,
  nurseries,
  closeDialog,
  formId,
  defaultDate = null,
  defaultNurseryId = null,
  defaultVarietyId = null,
}: Props) {
  const initial: PlantingFormState = { message: '', errors: {}, planting: null };
  const [state, formAction] = useActionState(actionNurserySow, initial);

  const form = useForm<z.input<typeof NurserySowSchema>>({
    resolver: zodResolver(NurserySowSchema) as Resolver<z.input<typeof NurserySowSchema>>,
    mode: 'onSubmit',
    defaultValues: {
      crop_variety_id: defaultVarietyId ?? undefined,
      qty: undefined,
      nursery_id: defaultNurseryId ?? '',
      event_date: defaultDate || '',
      notes: '',
      weight_grams: undefined,
    },
  });

  useEffect(() => {
    if (!state.message) return;
    // Map errors into RHF and show toast
    if (state.errors && Object.keys(state.errors).length > 0) {
      Object.entries(state.errors).forEach(([field, errors]) => {
        const msg = Array.isArray(errors)
          ? errors[0]
          : (errors as unknown as string) || 'Invalid value';
        form.setError(field as keyof NurserySowInput, { message: msg });
      });
      if (state.errors.notes) {
        const msg = Array.isArray(state.errors.notes) ? state.errors.notes[0] : state.errors.notes;
        setAttachmentError(typeof msg === 'string' ? msg : null);
      }
      toast.error(state.message);
    } else {
      toast.success(state.message);
      closeDialog();
    }
  }, [state, form, closeDialog]);

  const attachmentRef = useRef<HTMLInputElement | null>(null);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);

  useEffect(() => {
    form.reset({
      crop_variety_id: defaultVarietyId ?? undefined,
      qty: undefined,
      nursery_id: defaultNurseryId ?? '',
      event_date: defaultDate || '',
      notes: '',
      weight_grams: undefined,
    });
  }, [defaultDate, defaultNurseryId, defaultVarietyId, form]);

  const onSubmit = (values: unknown) => {
    const parsed: NurserySowInput = NurserySowSchema.parse(values);
    const fd = new FormData();
    fd.append('crop_variety_id', String(parsed.crop_variety_id));
    fd.append('qty', String(parsed.qty));
    fd.append('nursery_id', String(parsed.nursery_id));
    fd.append('event_date', parsed.event_date);
    if (parsed.notes) fd.append('notes', parsed.notes);
    if (parsed.weight_grams != null) fd.append('weight_grams', String(parsed.weight_grams));
    const attachment = attachmentRef.current?.files?.[0];
    if (attachment) {
      fd.append('attachment', attachment);
    }
    setAttachmentError(null);
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
                <Select
                  value={field.value ? String(field.value) : ''}
                  onValueChange={(v) => field.onChange(parseInt(v, 10))}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select a variety" />
                  </SelectTrigger>
                  <SelectContent>
                    {cropVarieties.map((v) => (
                      <SelectItem key={v.id} value={String(v.id)}>
                        {v.crops?.name ? `${v.crops.name} - ${v.name}` : v.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FormField
            control={form.control}
            name="qty"
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
                      field.onChange(digits === '' ? '' : Number(digits));
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
                      field.onChange(digits === '' ? '' : Number(digits));
                    }}
                    onWheel={(e) => (e.currentTarget as HTMLInputElement).blur()}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="nursery_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nursery</FormLabel>
              <FormControl>
                <Select
                  value={field.value ? String(field.value) : ''}
                  onValueChange={(v) => field.onChange(v)}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select a nursery" />
                  </SelectTrigger>
                  <SelectContent>
                    {nurseries.map((n) => (
                      <SelectItem key={n.id} value={n.id}>
                        {n.name}
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
              {typeof field.value === 'string' && field.value ? (
                <div className="text-xs text-muted-foreground">
                  Hawaiian moon:{' '}
                  <span className="font-medium">{hawaiianMoonForISO(field.value) ?? '—'}</span>{' '}
                  {(() => {
                    const info = hawaiianMoonInfoForISO(field.value);
                    return info ? `· ${info.recommendation}` : '';
                  })()}
                </div>
              ) : null}
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

        <div className="space-y-1">
          <FormLabel>Attachment (optional)</FormLabel>
          <Input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif"
            ref={attachmentRef}
            onChange={() => setAttachmentError(null)}
          />
          <p className="text-xs text-muted-foreground">
            Add a photo for traceability (max 5MB, jpeg/png/webp/avif).
          </p>
          {attachmentError ? <p className="text-sm text-destructive">{attachmentError}</p> : null}
        </div>
      </form>
    </Form>
  );
}
