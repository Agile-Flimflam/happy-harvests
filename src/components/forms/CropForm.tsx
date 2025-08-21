'use client';

import { useEffect, useState, useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { createCrop, updateCrop, type CropFormState, type CropStatus } from '@/app/actions/crops';
import type { Tables, Database } from '@/lib/supabase-server';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { DialogFooter, DialogClose } from "@/components/ui/dialog";

// Use base Crop type from generated types (via CropFormState import)
type Crop = Tables<'crops'>;

type CropVariety = Database['public']['Tables']['crop_varieties']['Row'];
type Bed = Tables<'beds'> & { plots?: { name: string } | null };

interface CropFormProps {
  crop?: Crop | null; // Use base Crop type
  cropVarieties: CropVariety[];
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

export function CropForm({ crop, cropVarieties, beds, closeDialog }: CropFormProps) {
  const isEditing = Boolean(crop?.id);
  const serverAction = isEditing ? updateCrop : createCrop;
  const initialState: CropFormState = { message: '', errors: [], crop: crop };
  const [state, formAction] = useActionState(serverAction, initialState);
  const [currentStatus, setCurrentStatus] = useState<CropStatus>(crop?.status ?? 'planned');

  useEffect(() => {
    if (state.message) {
        // Check if errors is an array and has length
        if (state.errors && Array.isArray(state.errors) && state.errors.length > 0) {
            toast.error(state.message, {
                description: state.errors.map(path => path.join('.') + ': Error').join('\n'), // Simple error path display
            });
        } else if (!state.errors) { // Only show success if no errors
            toast.success(state.message);
            closeDialog();
        }
    }
  }, [state, closeDialog]);

  // Default values need careful handling, especially for dates
  const defaultPlantedDate = formatDateForInput(state.crop?.planted_date);
  const defaultHarvestedDate = formatDateForInput(state.crop?.harvested_date);

  return (
    <form action={formAction} className="space-y-4">
      {isEditing && <input type="hidden" name="id" value={crop?.id} />}

      {/* Crop Variety Select - Use crop_variety_id */}
      <div>
        <Label htmlFor="crop_variety_id">Plant Variety</Label>
        {/* Use crop_variety_id for name and defaultValue */}
        <Select name="crop_variety_id" defaultValue={state.crop?.crop_variety_id ?? ''} required>
            <SelectTrigger id="crop_variety_id" aria-describedby="crop_variety_id-error" className="mt-1">
                <SelectValue placeholder="Select a variety" />
            </SelectTrigger>
            <SelectContent>
                {cropVarieties.map((variety) => (
                    <SelectItem key={variety.id} value={variety.id}>
                        {variety.name} {variety.variety ? `(${variety.variety})` : ''}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
        {/* Check for errors using crop_variety_id path */}
        <div id="crop_variety_id-error" aria-live="polite" aria-atomic="true">
          {state.errors?.find(path => path.includes('crop_variety_id')) && 
            <p className="mt-1 text-xs text-red-500">Plant Variety selection is required.</p> // Simplified error message
          }
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
                        {bed.name} ({bed.plots?.name ?? 'Unknown Plot'})
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
        {/* Check for errors using bed_id path */}
        <div id="bed_id-error" aria-live="polite" aria-atomic="true">
           {state.errors?.find(path => path.includes('bed_id')) && 
            <p className="mt-1 text-xs text-red-500">Bed selection is required.</p> // Simplified error message
          }
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
            {state.errors?.find(path => path.includes('status')) && 
                <p className="mt-1 text-xs text-red-500">Status selection is required.</p>
            }
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
            {state.errors?.find(path => path.includes('row_spacing_cm')) && 
                <p className="mt-1 text-xs text-red-500">Row spacing is required.</p>
            }
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
            {state.errors?.find(path => path.includes('seed_spacing_cm')) && 
                <p className="mt-1 text-xs text-red-500">Seed spacing is required.</p>
            }
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
            {state.errors?.find(path => path.includes('planted_date')) && 
                <p className="mt-1 text-xs text-red-500">Planted date is required.</p>
            }
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
            {state.errors?.find(path => path.includes('harvested_date')) && 
                <p className="mt-1 text-xs text-red-500">Harvested date is required.</p>
            }
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