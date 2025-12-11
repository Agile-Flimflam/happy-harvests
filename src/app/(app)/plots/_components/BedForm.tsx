'use client';

import { useEffect, startTransition } from 'react';
import { useActionState } from 'react';
import { createBed, updateBed, type BedFormState } from '../_actions';
import type { Tables } from '@/lib/supabase-server';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'; // Select for plot_id
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { formatSquareFeet, formatAcres, squareFeetToAcres } from '@/lib/utils';
// Notes removed in new schema; Textarea not needed
import { toast } from 'sonner';
// (Dialog footer handled by parent FormDialog)
import { useForm, type Resolver, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { BedSchema, type BedFormValues } from '@/lib/validation/plots';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';

type BedWithLocation = Tables<'beds'> & { plots?: { location_id: string | null } | null };
type Location = Tables<'locations'>;
type PlotForSelect = Tables<'plots'> & { locations?: Location | null };

interface BedFormProps {
  bed?: BedWithLocation | null;
  plots: PlotForSelect[]; // Need list of plots for the dropdown
  closeDialog: () => void;
  formId?: string;
  initialPlotId?: number | null;
  defaultSize?: { lengthInches?: number; widthInches?: number } | null;
  onCreated?: (bed: BedWithLocation) => void;
}

export function BedForm({
  bed,
  plots,
  closeDialog,
  formId,
  initialPlotId,
  defaultSize,
  onCreated,
}: BedFormProps) {
  const isEditing = Boolean(bed?.id);
  const action = isEditing ? updateBed : createBed;
  const initialState: BedFormState = { message: '', errors: {}, bed: bed };
  const [state, dispatch] = useActionState(action, initialState);
  const form = useForm<BedFormValues>({
    resolver: zodResolver(BedSchema) as Resolver<BedFormValues>,
    mode: 'onSubmit',
    defaultValues: {
      id: bed?.id,
      plot_id: bed?.plot_id ?? initialPlotId ?? ('' as unknown as number),
      length_inches:
        bed?.length_inches ?? defaultSize?.lengthInches ?? ('' as unknown as number | null),
      width_inches:
        bed?.width_inches ?? defaultSize?.widthInches ?? ('' as unknown as number | null),
      name: bed?.name ?? null,
    },
  });

  // (moved) watch is used after form initialization below

  useEffect(() => {
    if (state.message) {
      if (state.errors && Object.keys(state.errors).length > 0) {
        Object.entries(state.errors).forEach(([field, errors]) => {
          const message = Array.isArray(errors)
            ? errors[0]
            : (errors as unknown as string) || 'Invalid value';
          form.setError(field as keyof BedFormValues, { message });
        });
        toast.error(state.message);
      } else {
        toast.success(state.message);
        if (!isEditing && state.bed) {
          onCreated?.(state.bed);
        }
        closeDialog();
      }
    }
  }, [state, closeDialog, form, isEditing, onCreated]);

  // Ensure plot is preselected when creating from a specific plot
  useEffect(() => {
    if (!isEditing && initialPlotId != null) {
      form.setValue('plot_id', initialPlotId);
    }
  }, [isEditing, initialPlotId, form]);

  useEffect(() => {
    if (isEditing) return;
    if (defaultSize?.lengthInches) {
      form.setValue('length_inches', defaultSize.lengthInches);
    }
    if (defaultSize?.widthInches) {
      form.setValue('width_inches', defaultSize.widthInches);
    }
  }, [defaultSize, form, isEditing]);

  const onSubmit: SubmitHandler<BedFormValues> = async (values) => {
    const fd = new FormData();
    if (isEditing && bed?.id) fd.append('id', String(bed.id));
    fd.append('plot_id', String(values.plot_id));
    fd.append('length_inches', values.length_inches != null ? String(values.length_inches) : '');
    fd.append('width_inches', values.width_inches != null ? String(values.width_inches) : '');
    if (values.name != null) fd.append('name', values.name);
    startTransition(() => {
      dispatch(fd);
    });
  };

  const { watch } = form;
  const currentLength = watch('length_inches');
  const currentWidth = watch('width_inches');

  const effectiveFormId = formId ?? 'bedFormSubmit';

  return (
    <Form {...form}>
      <form
        id={effectiveFormId}
        onSubmit={form.handleSubmit(onSubmit)}
        noValidate
        className="space-y-4"
      >
        {isEditing && <input type="hidden" name="id" value={bed?.id} />}

        {/* Plot Select Field */}
        <FormField
          control={form.control}
          name="plot_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Plot</FormLabel>
              <FormControl>
                <Select
                  value={field.value ? String(field.value) : ''}
                  onValueChange={(val) => field.onChange(parseInt(val, 10))}
                >
                  <SelectTrigger className="mt-1 py-2" style={{ height: 44 }}>
                    <SelectValue placeholder="Select a plot" />
                  </SelectTrigger>
                  <SelectContent>
                    {plots.map((plot) => (
                      <SelectItem
                        key={plot.plot_id}
                        value={String(plot.plot_id)}
                        textValue={plot.name}
                      >
                        <span className="flex flex-col items-start text-left leading-tight">
                          <span className="font-medium">{plot.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {plot.locations?.name ?? 'No Location Assigned'}
                          </span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Bed Name */}
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Bed Name (optional)</FormLabel>
              <FormControl>
                <Input
                  type="text"
                  className="mt-1"
                  value={field.value ?? ''}
                  onChange={(e) => field.onChange(e.target.value || null)}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Dimensions Section using Fieldset */}
        <fieldset className="border p-4 rounded-md space-y-4">
          <legend className="text-sm font-medium px-1">Dimensions</legend>

          {/* Combined Length and Width Fields */}
          <div className="flex flex-col sm:flex-row items-start gap-4">
            {/* Length Field (Half Width) */}
            <FormField
              control={form.control}
              name="length_inches"
              render={({ field }) => (
                <FormItem className="flex-1">
                  <FormLabel>Length (in)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      className="mt-1"
                      value={field.value != null ? String(field.value) : ''}
                      onChange={(e) =>
                        field.onChange(e.target.value ? Number(e.target.value) : null)
                      }
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Width Field (Half Width) */}
            <FormField
              control={form.control}
              name="width_inches"
              render={({ field }) => (
                <FormItem className="flex-1">
                  <FormLabel>Width (in)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      className="mt-1"
                      value={field.value != null ? String(field.value) : ''}
                      onChange={(e) =>
                        field.onChange(e.target.value ? Number(e.target.value) : null)
                      }
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* Combined Calculated Area and Acreage Displays */}
          <div className="flex flex-col sm:flex-row items-start gap-4">
            {/* Display Calculated Area (Half Width) */}
            <div className="flex-1">
              <Label>Calculated Area</Label>
              <p className="text-sm text-muted-foreground mt-1">
                {(() => {
                  const lengthNum =
                    typeof currentLength === 'number'
                      ? currentLength
                      : parseFloat(String(currentLength ?? ''));
                  const widthNum =
                    typeof currentWidth === 'number'
                      ? currentWidth
                      : parseFloat(String(currentWidth ?? ''));
                  if (!isNaN(lengthNum) && !isNaN(widthNum) && lengthNum > 0 && widthNum > 0) {
                    const areaSqIn = lengthNum * widthNum;
                    const areaSqFt = areaSqIn / 144;
                    const display = formatSquareFeet(areaSqFt);
                    const exact = formatSquareFeet(areaSqFt, { variant: 'tooltip' });
                    return (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="cursor-help">{display} sq ft</span>
                        </TooltipTrigger>
                        <TooltipContent>{exact} sq ft</TooltipContent>
                      </Tooltip>
                    );
                  }
                  return '-';
                })()}
              </p>
            </div>

            {/* Display Calculated Acreage (Half Width) */}
            <div className="flex-1">
              <Label>Calculated Acreage</Label>
              <p className="text-sm text-muted-foreground mt-1">
                {(() => {
                  const lengthNum =
                    typeof currentLength === 'number'
                      ? currentLength
                      : parseFloat(String(currentLength ?? ''));
                  const widthNum =
                    typeof currentWidth === 'number'
                      ? currentWidth
                      : parseFloat(String(currentWidth ?? ''));
                  if (!isNaN(lengthNum) && !isNaN(widthNum) && lengthNum > 0 && widthNum > 0) {
                    const areaSqIn = lengthNum * widthNum;
                    const areaSqFt = areaSqIn / 144;
                    const acresRaw = squareFeetToAcres(areaSqFt);
                    const display = formatAcres(acresRaw);
                    const exact = formatAcres(acresRaw, { variant: 'tooltip' });
                    if (!display) return '—';
                    return (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="cursor-help">{display} ac</span>
                        </TooltipTrigger>
                        {exact && <TooltipContent>{exact} ac</TooltipContent>}
                      </Tooltip>
                    );
                  }
                  return '-';
                })()}
              </p>
            </div>
          </div>
        </fieldset>

        {/* No notes field in new schema */}

        {/* Footer handled by parent FormDialog */}
      </form>
    </Form>
  );
}
