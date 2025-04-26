'use client';

import { useEffect } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { createPlant, updatePlant, type PlantFormState } from '@/app/actions/plants';
import type { Tables } from '@/lib/supabase';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner"; // Assuming sonner for toasts
import { DialogFooter, DialogClose } from "@/components/ui/dialog";

type Plant = Tables<'plants'>;

interface PlantFormProps {
  plant?: Plant | null; // Plant data for editing, null/undefined for adding
  closeDialog: () => void;
}

function SubmitButton({ isEditing }: { isEditing: boolean }) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending} aria-disabled={pending}>
      {pending ? (isEditing ? 'Updating...' : 'Creating...') : (isEditing ? 'Update Plant' : 'Create Plant')}
    </Button>
  );
}

export function PlantForm({ plant, closeDialog }: PlantFormProps) {
  const isEditing = Boolean(plant?.id);
  const action = isEditing ? updatePlant : createPlant;
  const initialState: PlantFormState = { message: '', errors: {}, plant: plant }; // Pass existing plant data for update initial state
  const [state, dispatch] = useFormState(action, initialState);

  useEffect(() => {
    if (state.message) {
        if (state.errors && Object.keys(state.errors).length > 0) {
            // Error toast
            toast.error(state.message, {
                description: Object.entries(state.errors)
                    .map(([key, value]) => {
                        // Ensure value is an array before joining
                        const errorString = Array.isArray(value) ? value.join(', ') : 'Invalid error format';
                        return `${key}: ${errorString}`;
                    })
                    .join('\n'),
            });
        } else {
            // Success toast
            toast.success(state.message);
            closeDialog(); // Close dialog on success
        }
    }
  }, [state, closeDialog]);

  return (
    <form action={dispatch} className="space-y-4">
      {/* Hidden input for ID if editing */}
      {isEditing && <input type="hidden" name="id" value={plant?.id} />} 

      {/* Name Field */}
      <div>
        <Label htmlFor="name">Plant Name</Label>
        <Input
          id="name"
          name="name"
          defaultValue={state.plant?.name ?? ''}
          required
          aria-describedby="name-error"
          className="mt-1"
        />
        <div id="name-error" aria-live="polite" aria-atomic="true">
          {state.errors?.name &&
            state.errors.name.map((error: string) => (
              <p className="mt-1 text-xs text-red-500" key={error}>
                {error}
              </p>
            ))}
        </div>
      </div>

       {/* Variety Field */}
      <div>
        <Label htmlFor="variety">Variety</Label>
        <Input
          id="variety"
          name="variety"
          defaultValue={state.plant?.variety ?? ''}
          aria-describedby="variety-error"
           className="mt-1"
        />
         <div id="variety-error" aria-live="polite" aria-atomic="true">
          {state.errors?.variety &&
            state.errors.variety.map((error: string) => (
              <p className="mt-1 text-xs text-red-500" key={error}>
                {error}
              </p>
            ))}
        </div>
      </div>

       {/* Latin Name Field */}
       <div>
        <Label htmlFor="latin_name">Latin Name</Label>
        <Input
          id="latin_name"
          name="latin_name"
          defaultValue={state.plant?.latin_name ?? ''}
          aria-describedby="latin_name-error"
           className="mt-1"
        />
         <div id="latin_name-error" aria-live="polite" aria-atomic="true">
          {state.errors?.latin_name &&
            state.errors.latin_name.map((error: string) => (
              <p className="mt-1 text-xs text-red-500" key={error}>
                {error}
              </p>
            ))}
        </div>
      </div>

      {/* Average Days to Maturity Field */}
      <div>
        <Label htmlFor="avg_days_to_maturity">Average Days to Maturity</Label>
        <Input
          id="avg_days_to_maturity"
          name="avg_days_to_maturity"
          type="number"
          defaultValue={state.plant?.avg_days_to_maturity ?? ''}
           aria-describedby="avg_days_to_maturity-error"
          className="mt-1"
        />
         <div id="avg_days_to_maturity-error" aria-live="polite" aria-atomic="true">
          {state.errors?.avg_days_to_maturity &&
            state.errors.avg_days_to_maturity.map((error: string) => (
              <p className="mt-1 text-xs text-red-500" key={error}>
                {error}
              </p>
            ))}
        </div>
      </div>

      {/* Is Organic Field */}
      <div className="flex items-center space-x-2">
        <Checkbox
            id="is_organic"
            name="is_organic"
            defaultChecked={state.plant?.is_organic ?? false}
            aria-describedby="is_organic-error"
         />
        <Label htmlFor="is_organic" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
            Is Organic?
        </Label>
         <div id="is_organic-error" aria-live="polite" aria-atomic="true">
          {state.errors?.is_organic &&
            state.errors.is_organic.map((error: string) => (
              <p className="mt-1 text-xs text-red-500" key={error}>
                {error}
              </p>
            ))}
        </div>
      </div>

      {/* Server Action Message Display */}
      {/* Removed direct message display, handled by toast */} 

      <DialogFooter>
        <DialogClose asChild>
             <Button variant="outline">Cancel</Button>
        </DialogClose>
        <SubmitButton isEditing={isEditing} />
      </DialogFooter>
    </form>
  );
} 