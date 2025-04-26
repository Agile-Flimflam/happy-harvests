'use client';

import { useEffect, useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { createCrop, updateCrop, type CropFormState, type CropStatus } from '@/app/actions/crops';
import type { Tables } from '@/lib/supabase';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { DialogFooter, DialogClose } from "@/components/ui/dialog";

type Crop = Tables<'crops'>;
type Plant = Tables<'plants'>;
type Bed = Tables<'beds'> & { plots?: { name: string } | null }; // Include plot name from getBeds query

interface CropFormProps {
  crop?: Crop | null;
  plants: Plant[];
  beds: Bed[];
  closeDialog: () => void;
}

// Helper to format date for input[type=date]
function formatDateForInput(date: Date | string | null | undefined): string {
    if (!date) return '';
    try {
        // If it's already a string in YYYY-MM-DD format, use it directly
        if (typeof date === 'string' && /\d{4}-\d{2}-\d{2}/.test(date)) {
            return date;
        }
        return new Date(date).toISOString().split('T')[0];
    } catch {
        return ''; // Handle invalid date strings gracefully
    }
}

const cropStatuses: CropStatus[] = ['planned', 'planted', 'growing', 'harvested'];

function SubmitButton({ isEditing }: { isEditing: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} aria-disabled={pending}>
      {pending ? (isEditing ? 'Updating...' : 'Creating...') : (isEditing ? 'Update Crop' : 'Create Crop')}
    </Button>
  );
}

export function CropForm({ crop, plants, beds, closeDialog }: CropFormProps) {
  const isEditing = Boolean(crop?.id);
  const action = isEditing ? updateCrop : createCrop;
  const initialState: CropFormState = { message: '', errors: {}, crop: crop };
  const [state, dispatch] = useFormState(action, initialState);
  const [currentStatus, setCurrentStatus] = useState<CropStatus>(crop?.status ?? 'planned');

   useEffect(() => {
    if (state.message) {
        if (state.errors && Object.keys(state.errors).length > 0) {
            toast.error(state.message, {
                description: Object.entries(state.errors)
                    .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(', ') : 'Invalid error format'}`)
                    .join('\n'),
            });
        } else {
            toast.success(state.message);
            closeDialog();
        }
    }
  }, [state, closeDialog]);

  // Default values need careful handling, especially for dates
  const defaultPlantedDate = formatDateForInput(state.crop?.planted_date);
  const defaultHarvestedDate = formatDateForInput(state.crop?.harvested_date);

  return (
    <form action={dispatch} className="space-y-4">
      {isEditing && <input type="hidden" name="id" value={crop?.id} />}

      {/* Plant Select */}
      <div>
        <Label htmlFor="plant_id">Plant</Label>
        <Select name="plant_id" defaultValue={state.crop?.plant_id ?? ''} required>
            <SelectTrigger id="plant_id" aria-describedby="plant_id-error" className="mt-1">
                <SelectValue placeholder="Select a plant" />
            </SelectTrigger>
            <SelectContent>
                {plants.map((plant) => (
                    <SelectItem key={plant.id} value={plant.id}>
                        {plant.name} {plant.variety ? `(${plant.variety})` : ''}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
        <div id="plant_id-error" aria-live="polite" aria-atomic="true">
          {state.errors?.plant_id && state.errors.plant_id.map((error: string) => <p className="mt-1 text-xs text-red-500" key={error}>{error}</p>)}
        </div>
      </div>

       {/* Bed Select */}
      <div>
        <Label htmlFor="bed_id">Bed (Plot)</Label>
        <Select name="bed_id" defaultValue={state.crop?.bed_id ?? ''} required>
            <SelectTrigger id="bed_id" aria-describedby="bed_id-error" className="mt-1">
                <SelectValue placeholder="Select a bed" />
            </SelectTrigger>
            <SelectContent>
                {beds.map((bed) => (
                    <SelectItem key={bed.id} value={bed.id}>
                         {/* Display Bed Name (Plot Name) */}
                        {bed.name} ({bed.plots?.name ?? 'Unknown Plot'})
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
        <div id="bed_id-error" aria-live="polite" aria-atomic="true">
          {state.errors?.bed_id && state.errors.bed_id.map((error: string) => <p className="mt-1 text-xs text-red-500" key={error}>{error}</p>)}
        </div>
      </div>

      {/* Status Select */}
      <div>
        <Label htmlFor="status">Status</Label>
        <Select 
          name="status" 
          defaultValue={state.crop?.status ?? 'planned'}
          onValueChange={(value) => setCurrentStatus(value as CropStatus)}
        >
            <SelectTrigger id="status" aria-describedby="status-error" className="mt-1">
                <SelectValue placeholder="Select status" />
            </SelectTrigger>
            <SelectContent>
                {cropStatuses.map((status) => (
                    <SelectItem key={status} value={status}>
                        {status.charAt(0).toUpperCase() + status.slice(1)} {/* Capitalize */}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
         <div id="status-error" aria-live="polite" aria-atomic="true">
            {state.errors?.status && state.errors.status.map((error: string) => <p className="mt-1 text-xs text-red-500" key={error}>{error}</p>)}
         </div>
      </div>

       {/* Row Spacing */}
      <div>
        <Label htmlFor="row_spacing_cm">Row Spacing (cm)</Label>
        <Input
          id="row_spacing_cm"
          name="row_spacing_cm"
          type="number"
          defaultValue={state.crop?.row_spacing_cm ?? ''}
           aria-describedby="row_spacing_cm-error"
          className="mt-1"
        />
        <div id="row_spacing_cm-error" aria-live="polite" aria-atomic="true">
            {state.errors?.row_spacing_cm && state.errors.row_spacing_cm.map((error: string) => <p className="mt-1 text-xs text-red-500" key={error}>{error}</p>)}
        </div>
      </div>

      {/* Seed Spacing */}
      <div>
        <Label htmlFor="seed_spacing_cm">Seed Spacing (cm)</Label>
        <Input
          id="seed_spacing_cm"
          name="seed_spacing_cm"
          type="number"
          defaultValue={state.crop?.seed_spacing_cm ?? ''}
          aria-describedby="seed_spacing_cm-error"
          className="mt-1"
        />
         <div id="seed_spacing_cm-error" aria-live="polite" aria-atomic="true">
            {state.errors?.seed_spacing_cm && state.errors.seed_spacing_cm.map((error: string) => <p className="mt-1 text-xs text-red-500" key={error}>{error}</p>)}
        </div>
      </div>

      {/* Planted Date */}
      <div>
        <Label htmlFor="planted_date">Planted Date</Label>
        <Input
          id="planted_date"
          name="planted_date"
          type="date"
          defaultValue={defaultPlantedDate}
          aria-describedby="planted_date-error"
          className="mt-1"
        />
         <div id="planted_date-error" aria-live="polite" aria-atomic="true">
            {state.errors?.planted_date && state.errors.planted_date.map((error: string) => <p className="mt-1 text-xs text-red-500" key={error}>{error}</p>)}
        </div>
      </div>

       {/* Harvested Date */}
       <div>
        <Label htmlFor="harvested_date">Harvested Date</Label>
        <Input
          id="harvested_date"
          name="harvested_date"
          type="date"
          defaultValue={defaultHarvestedDate}
          disabled={currentStatus !== 'harvested'}
          aria-describedby="harvested_date-error"
          className="mt-1"
        />
         <div id="harvested_date-error" aria-live="polite" aria-atomic="true">
            {state.errors?.harvested_date && state.errors.harvested_date.map((error: string) => <p className="mt-1 text-xs text-red-500" key={error}>{error}</p>)}
        </div>
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