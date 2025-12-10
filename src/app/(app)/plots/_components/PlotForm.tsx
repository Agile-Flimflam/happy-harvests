'use client';

import { useEffect, useLayoutEffect, useRef, startTransition } from 'react';
import { useActionState } from 'react';
import { createPlot, updatePlot, type PlotFormState } from '../_actions';
import type { Tables } from '@/lib/supabase-server';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
// (Dialog footer handled by parent FormDialog)
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { PlotSchema, type PlotFormValues } from '@/lib/validation/plots';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { setupFormControlProperty } from '@/lib/form-utils';

type Plot = Tables<'plots'>;
type Location = Tables<'locations'>;

interface PlotFormProps {
  plot?: Plot | null;
  locations: Location[];
  closeDialog: () => void;
  formId?: string;
  defaultLocationId?: string | null;
}

// Submit button is owned by parent dialog footer

export function PlotForm({
  plot,
  locations,
  closeDialog,
  formId,
  defaultLocationId,
}: PlotFormProps) {
  const plotId = typeof plot?.plot_id === 'number' ? plot.plot_id : undefined;
  const isEditing = Boolean(plotId);
  const action = isEditing ? updatePlot : createPlot;
  const initialState: PlotFormState = { message: '', errors: {}, plot: plot };
  const [state, dispatch] = useActionState(action, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  const form = useForm<PlotFormValues>({
    resolver: zodResolver(PlotSchema),
    mode: 'onSubmit',
    defaultValues: {
      plot_id: plotId,
      name: plot?.name ?? '',
      location_id:
        plot?.location_id != null
          ? plot.location_id.toString()
          : defaultLocationId != null
            ? defaultLocationId
            : '',
    },
  });

  useEffect(() => {
    if (state.message) {
      const fieldErrors = state.errors;
      if (fieldErrors && Object.keys(fieldErrors).length > 0) {
        const validFields: Array<keyof PlotFormValues> = ['plot_id', 'name', 'location_id'];
        Object.entries(fieldErrors).forEach(([field, errors]) => {
          const message = Array.isArray(errors)
            ? errors[0]
            : typeof errors === 'string'
              ? errors
              : 'Invalid value';
          if (validFields.includes(field as keyof PlotFormValues)) {
            form.setError(field as keyof PlotFormValues, { message });
          } else {
            // Surface unexpected errors to the user without attaching to a field
            toast.error(message);
          }
        });
        toast.error(state.message);
      } else {
        toast.success(state.message);
        closeDialog();
      }
    }
  }, [state, closeDialog, form]);

  // Ensure form.control exists to satisfy aggressive browser extensions
  useLayoutEffect(() => {
    setupFormControlProperty(formRef.current);
  }, []);

  useEffect(() => {
    if (isEditing) return;
    if (!defaultLocationId) return;
    const exists = locations.some((loc) => String(loc.id) === defaultLocationId);
    if (!exists) return;
    form.setValue('location_id', defaultLocationId);
  }, [defaultLocationId, form, isEditing, locations]);

  const onSubmit: SubmitHandler<PlotFormValues> = async (values) => {
    const fd = new FormData();
    if (isEditing && plotId !== undefined) fd.append('plot_id', String(plotId));
    fd.append('name', values.name);
    fd.append('location_id', values.location_id ?? '');
    startTransition(() => {
      dispatch(fd);
    });
  };

  return (
    <Form {...form}>
      <form
        id={formId}
        ref={formRef}
        onSubmit={form.handleSubmit(onSubmit)}
        noValidate
        className="space-y-4"
      >
        {isEditing && plotId !== undefined ? (
          <input type="hidden" name="plot_id" value={plotId} />
        ) : null}

        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="location_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Location</FormLabel>
              <FormControl>
                <Select value={field.value ?? ''} onValueChange={field.onChange}>
                  <SelectTrigger className="mt-1 w-full">
                    <SelectValue placeholder="Select a location" />
                  </SelectTrigger>
                  <SelectContent>
                    {locations.map((loc) => (
                      <SelectItem key={loc.id} value={String(loc.id)}>
                        {loc.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Footer handled by parent FormDialog */}
      </form>
    </Form>
  );
}
