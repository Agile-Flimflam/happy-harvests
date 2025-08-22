'use client';

import { useEffect, useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import type { Tables, Enums } from '@/lib/supabase-server';
import { createPlanting, updatePlanting, type PlantingFormState } from '../_actions';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { DialogFooter, DialogClose } from "@/components/ui/dialog";
import { toast } from "sonner";

type Planting = Tables<'bed_plantings'>;
type CropVariety = Pick<Tables<'crop_varieties'>, 'id' | 'name' | 'latin_name'> & { crops?: { name: string } | null };
type Bed = Pick<Tables<'beds'>, 'id' | 'length_inches' | 'width_inches'> & { plots?: { locations: { name: string } | null } | null };

interface PlantingFormProps {
  planting?: Planting | null;
  cropVarieties: CropVariety[];
  beds: Bed[];
  closeDialog: () => void;
}

function SubmitButton({ isEditing }: { isEditing: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} aria-disabled={pending}>
      {pending ? (isEditing ? 'Updating...' : 'Creating...') : (isEditing ? 'Update Planting' : 'Create Planting')}
    </Button>
  );
}

export function PlantingForm({ planting, cropVarieties, beds, closeDialog }: PlantingFormProps) {
  const isEditing = Boolean(planting?.id);
  const action = isEditing ? updatePlanting : createPlanting;
  const initialState: PlantingFormState = { message: '', errors: {}, planting };
  const [state, formAction] = useActionState(action, initialState);

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
        toast.error(state.message);
      } else {
        toast.success(state.message);
        closeDialog();
      }
    }
  }, [state, closeDialog]);

  return (
    <form action={formAction} className="space-y-4">
      {isEditing && <input type="hidden" name="id" value={planting?.id} />}

      <div>
        <Label htmlFor="crop_variety_id">Plant Variety</Label>
        <Select name="crop_variety_id" defaultValue={state.planting?.crop_variety_id?.toString() ?? ''} required>
          <SelectTrigger id="crop_variety_id" aria-describedby="crop_variety_id-error" className="mt-1">
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
        <div id="crop_variety_id-error" aria-live="polite" aria-atomic="true" />
      </div>

      <div>
        <Label htmlFor="bed_id">Bed</Label>
        <Select name="bed_id" defaultValue={state.planting?.bed_id?.toString() ?? ''} required>
          <SelectTrigger id="bed_id" aria-describedby="bed_id-error" className="mt-1">
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
        <div id="bed_id-error" aria-live="polite" aria-atomic="true" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="planting_type">Planting Type</Label>
          <Select name="planting_type" defaultValue={(state.planting?.planting_type as Enums<'planting_type'> | undefined) ?? undefined} required>
            <SelectTrigger id="planting_type" className="mt-1">
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Direct Seed">Direct Seed</SelectItem>
              <SelectItem value="Transplant">Transplant</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="qty_planting">Quantity</Label>
          <Input id="qty_planting" name="qty_planting" type="number" defaultValue={state.planting?.qty_planting ?? ''} className="mt-1" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="date_planted">Date Planted</Label>
          <Input id="date_planted" name="date_planted" type="date" defaultValue={state.planting?.date_planted ?? ''} className="mt-1" required />
        </div>
        <div>
          <Label htmlFor="harvested_date">Harvested Date</Label>
          <Input id="harvested_date" name="harvested_date" type="date" defaultValue={state.planting?.harvested_date ?? ''} className="mt-1" />
        </div>
      </div>

      <div>
        <Label htmlFor="status">Status</Label>
        <Select name="status" defaultValue={state.planting?.status as Enums<'bed_planting_status'> | undefined} required>
          <SelectTrigger id="status" className="mt-1">
            <SelectValue placeholder="Select status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Planted">Planted</SelectItem>
            <SelectItem value="Nursery">Nursery</SelectItem>
            <SelectItem value="Harvested">Harvested</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="notes">Notes</Label>
        <Textarea id="notes" name="notes" defaultValue={state.planting?.notes ?? ''} className="mt-1" rows={3} />
      </div>

      <DialogFooter>
        <DialogClose asChild>
          <Button variant="outline">Cancel</Button>
        </DialogClose>
        <SubmitButton isEditing={isEditing} />
      </DialogFooter>
    </form>
  );
}


