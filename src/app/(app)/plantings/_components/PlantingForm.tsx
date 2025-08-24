'use client';

import { useEffect, startTransition } from 'react';
import { useActionState } from 'react';
import type { Tables, Enums } from '@/lib/supabase-server';
import { createPlanting, updatePlanting, type PlantingFormState } from '../_actions';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { DialogFooter, DialogClose } from "@/components/ui/dialog";
import { toast } from "sonner";
import { useForm, type Resolver, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { PlantingSchema, type PlantingFormValues } from '@/lib/validation/plantings';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';

type Planting = Tables<'bed_plantings'>;
type CropVariety = Pick<Tables<'crop_varieties'>, 'id' | 'name' | 'latin_name'> & { crops?: { name: string } | null };
type Bed = Pick<Tables<'beds'>, 'id' | 'length_inches' | 'width_inches'> & { plots?: { locations: { name: string } | null } | null };

interface PlantingFormProps {
  planting?: Planting | null;
  cropVarieties: CropVariety[];
  beds: Bed[];
  closeDialog: () => void;
}

function SubmitButton({ isEditing, submitting }: { isEditing: boolean; submitting: boolean }) {
  return (
    <Button type="submit" disabled={submitting} aria-disabled={submitting}>
      {submitting ? (isEditing ? 'Updating...' : 'Creating...') : (isEditing ? 'Update Planting' : 'Create Planting')}
    </Button>
  );
}

export function PlantingForm({ planting, cropVarieties, beds, closeDialog }: PlantingFormProps) {
  const isEditing = Boolean(planting?.id);
  const action = isEditing ? updatePlanting : createPlanting;
  const initialState: PlantingFormState = { message: '', errors: {}, planting };
  const [state, formAction] = useActionState(action, initialState);

  const form = useForm<PlantingFormValues>({
    resolver: zodResolver(PlantingSchema) as Resolver<PlantingFormValues>,
    mode: 'onSubmit',
    defaultValues: {
      id: planting?.id,
      crop_variety_id: planting?.crop_variety_id ?? ('' as unknown as number),
      bed_id: planting?.bed_id ?? ('' as unknown as number),
      planting_type: (planting?.planting_type as Enums<'planting_type'> | undefined) ?? undefined,
      qty_planting: planting?.qty_planting ?? ('' as unknown as number),
      date_planted: planting?.date_planted ?? '',
      harvested_date: planting?.harvested_date ?? null,
      status: (planting?.status as Enums<'bed_planting_status'> | undefined) ?? undefined,
      notes: planting?.notes ?? '',
    },
  });

  // Group varieties by crop
  const groupedVarieties = cropVarieties.reduce((acc, v) => {
    const cropName = v.crops?.name ?? 'Unknown';
    if (!acc[cropName]) acc[cropName] = [];
    acc[cropName].push(v);
    return acc;
  }, {} as Record<string, CropVariety[]>);

  // Sort crops and varieties within each crop
  const sortedGroups = Object.entries(groupedVarieties)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([crop, varieties]) => [
      crop,
      varieties.sort((a, b) => a.name.localeCompare(b.name))
    ] as const);

  useEffect(() => {
    if (state.message) {
      if (state.errors && Object.keys(state.errors).length > 0) {
        Object.entries(state.errors).forEach(([field, errors]) => {
          const message = Array.isArray(errors) ? errors[0] : (errors as unknown as string) || 'Invalid value';
          form.setError(field as keyof PlantingFormValues, { message });
        });
        toast.error(state.message);
      } else {
        toast.success(state.message);
        closeDialog();
      }
    }
  }, [state, closeDialog, form]);

  const onSubmit: SubmitHandler<PlantingFormValues> = async (values) => {
    const fd = new FormData();
    if (isEditing && planting?.id) fd.append('id', String(planting.id));
    fd.append('crop_variety_id', String(values.crop_variety_id));
    fd.append('bed_id', String(values.bed_id));
    fd.append('planting_type', String(values.planting_type ?? ''));
    fd.append('qty_planting', String(values.qty_planting));
    fd.append('date_planted', values.date_planted);
    fd.append('harvested_date', values.harvested_date ?? '');
    fd.append('status', String(values.status ?? ''));
    fd.append('notes', values.notes ?? '');
    startTransition(() => {
      formAction(fd);
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-4">
        {isEditing && <input type="hidden" name="id" value={planting?.id} />}

        <FormField
          control={form.control}
          name="crop_variety_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Plant Variety</FormLabel>
              <FormControl>
                <Select value={field.value ? String(field.value) : ''} onValueChange={(val) => field.onChange(parseInt(val, 10))}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select a variety" />
                  </SelectTrigger>
                  <SelectContent>
                    {sortedGroups.map(([cropName, varieties]) => (
                      <SelectGroup key={cropName}>
                        <SelectLabel>{cropName}</SelectLabel>
                        {varieties.map((v) => (
                          <SelectItem key={v.id} value={v.id.toString()} className="pl-6">
                            {v.name}
                          </SelectItem>
                        ))}
                      </SelectGroup>
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
          name="bed_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Bed</FormLabel>
              <FormControl>
                <Select value={field.value ? String(field.value) : ''} onValueChange={(val) => field.onChange(parseInt(val, 10))}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select a bed" />
                  </SelectTrigger>
                  <SelectContent>
                    {beds.map((b) => (
                      <SelectItem key={b.id} value={b.id.toString()}>
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

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="planting_type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Planting Type</FormLabel>
                <FormControl>
                  <Select value={field.value ?? ''} onValueChange={field.onChange}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Direct Seed">Direct Seed</SelectItem>
                      <SelectItem value="Transplant">Transplant</SelectItem>
                    </SelectContent>
                  </Select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="qty_planting"
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
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="date_planted"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Date Planted</FormLabel>
                <FormControl>
                  <Input type="date" className="mt-1" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="harvested_date"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Harvested Date</FormLabel>
                <FormControl>
                  <Input type="date" className="mt-1" value={field.value ?? ''} onChange={(e) => field.onChange(e.target.value || null)} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="status"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Status</FormLabel>
              <FormControl>
                <Select value={field.value ?? ''} onValueChange={field.onChange}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Planted">Planted</SelectItem>
                    <SelectItem value="Nursery">Nursery</SelectItem>
                    <SelectItem value="Harvested">Harvested</SelectItem>
                  </SelectContent>
                </Select>
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
                <Textarea className="mt-1" rows={3} {...field} value={field.value ?? ''} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <SubmitButton isEditing={isEditing} submitting={form.formState.isSubmitting} />
        </DialogFooter>
      </form>
    </Form>
  );
}


