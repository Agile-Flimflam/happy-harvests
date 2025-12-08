'use client';

import { useEffect, useLayoutEffect, useRef, startTransition } from 'react';
import { useActionState } from 'react';
import { createPlot, updatePlot, type PlotFormState } from '../_actions';
import type { Tables } from '@/lib/supabase-server';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
// (Dialog footer handled by parent FormDialog)
import { useForm, type Resolver, type SubmitHandler } from 'react-hook-form';
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
}

// Submit button is owned by parent dialog footer

export function PlotForm({ plot, locations, closeDialog, formId }: PlotFormProps) {
  const isEditing = Boolean(plot?.plot_id);
  const action = isEditing ? updatePlot : createPlot;
  const initialState: PlotFormState = { message: '', errors: {}, plot: plot };
  const [state, dispatch] = useActionState(action, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  const form = useForm<PlotFormValues>({
    resolver: zodResolver(PlotSchema) as Resolver<PlotFormValues>,
    mode: 'onSubmit',
    defaultValues: {
      plot_id: plot?.plot_id,
      name: plot?.name ?? '',
      location_id: plot?.location_id ?? '',
    },
  });

  useEffect(() => {
    if (state.message) {
      if (state.errors && Object.keys(state.errors).length > 0) {
        Object.entries(state.errors).forEach(([field, errors]) => {
          const message = Array.isArray(errors)
            ? errors[0]
            : (errors as unknown as string) || 'Invalid value';
          // name and location_id are only expected keys
          form.setError(field as keyof PlotFormValues, { message });
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

  const onSubmit: SubmitHandler<PlotFormValues> = async (values) => {
    const fd = new FormData();
    if (isEditing && plot?.plot_id) fd.append('plot_id', String(plot.plot_id));
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
        {isEditing && <input type="hidden" name="plot_id" value={plot?.plot_id} />}

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
                      <SelectItem key={loc.id} value={loc.id}>
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
