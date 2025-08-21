'use client';

import { useEffect } from 'react';
import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { createCropVariety, updateCropVariety, type CropVarietyFormState } from '@/app/actions/crop-varieties';
import type { Tables } from '@/lib/supabase-server';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner"; // Assuming sonner for toasts
import { DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type CropVariety = Tables<'crop_varieties'>;

interface CropVarietyFormProps {
  cropVariety?: CropVariety | null; // Rename prop
  closeDialog: () => void;
}

function SubmitButton({ isEditing }: { isEditing: boolean }) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending} aria-disabled={pending}>
      {/* Update button text */}
      {pending ? (isEditing ? 'Updating...' : 'Creating...') : (isEditing ? 'Update Crop Variety' : 'Create Crop Variety')}
    </Button>
  );
}

export function CropVarietyForm({ cropVariety, closeDialog }: CropVarietyFormProps) {
  const isEditing = Boolean(cropVariety?.id);
  // Update action functions
  const action = isEditing ? updateCropVariety : createCropVariety;
  // Update initial state type and property name
  const initialState: CropVarietyFormState = { message: '', errors: {}, cropVariety: cropVariety };
  const [state, dispatch] = useActionState(action, initialState);

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
      {isEditing && <input type="hidden" name="id" value={cropVariety?.id} />}

      {/* Name Field */}
      <div>
        {/* Update label */}
        <Label htmlFor="name">Crop Variety Name</Label>
        <Input
          id="name"
          name="name"
          // Update state reference
          defaultValue={state.cropVariety?.name ?? ''}
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
        <Label htmlFor="variety">Variety</Label> {/* Clarify label slightly */}
        <Input
          id="variety"
          name="variety"
          // Update state reference
          defaultValue={state.cropVariety?.variety ?? ''}
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
          // Update state reference
          defaultValue={state.cropVariety?.latin_name ?? ''}
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

      {/* START :: Characteristics Grouping */}
      <fieldset className="border p-4 rounded-md space-y-4">
        <legend className="text-sm font-medium px-1">Characteristics</legend>

        {/* Days to Maturity Fields */}
        <fieldset className="border p-3 rounded-md">
          <legend className="text-sm font-medium px-1">Days to Maturity</legend>
          <div className="grid grid-cols-2 gap-6">
            {/* Direct Seed section */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium">Direct Seed</h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="directSeedMin">Min Days</Label>
                  <Input
                    id="directSeedMin"
                    name="directSeedMin"
                    type="number"
                    defaultValue={state.cropVariety?.days_to_maturity?.DirectSeed?.min ?? ''}
                    aria-describedby="directSeedMin-error"
                    className="mt-1"
                    required
                  />
                  <div id="directSeedMin-error" aria-live="polite" aria-atomic="true">
                    {state.errors?.directSeedMin &&
                      state.errors.directSeedMin.map((error: string) => (
                        <p className="mt-1 text-xs text-red-500" key={error}>
                          {error}
                        </p>
                      ))}
                  </div>
                </div>
                <div>
                  <Label htmlFor="directSeedMax">Max Days</Label>
                  <Input
                    id="directSeedMax"
                    name="directSeedMax"
                    type="number"
                    defaultValue={state.cropVariety?.days_to_maturity?.DirectSeed?.max ?? ''}
                    aria-describedby="directSeedMax-error"
                    className="mt-1"
                    required
                  />
                  <div id="directSeedMax-error" aria-live="polite" aria-atomic="true">
                    {state.errors?.directSeedMax &&
                      state.errors.directSeedMax.map((error: string) => (
                        <p className="mt-1 text-xs text-red-500" key={error}>
                          {error}
                        </p>
                      ))}
                  </div>
                </div>
              </div>
            </div>
            
            {/* Transplant section */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium">Transplant</h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="transplantMin">Min Days</Label>
                  <Input
                    id="transplantMin"
                    name="transplantMin"
                    type="number"
                    defaultValue={state.cropVariety?.days_to_maturity?.Transplant?.min ?? ''}
                    aria-describedby="transplantMin-error"
                    className="mt-1"
                    required
                  />
                  <div id="transplantMin-error" aria-live="polite" aria-atomic="true">
                    {state.errors?.transplantMin &&
                      state.errors.transplantMin.map((error: string) => (
                        <p className="mt-1 text-xs text-red-500" key={error}>
                          {error}
                        </p>
                      ))}
                  </div>
                </div>
                <div>
                  <Label htmlFor="transplantMax">Max Days</Label>
                  <Input
                    id="transplantMax"
                    name="transplantMax"
                    type="number"
                    defaultValue={state.cropVariety?.days_to_maturity?.Transplant?.max ?? ''}
                    aria-describedby="transplantMax-error"
                    className="mt-1"
                    required
                  />
                  <div id="transplantMax-error" aria-live="polite" aria-atomic="true">
                    {state.errors?.transplantMax &&
                      state.errors.transplantMax.map((error: string) => (
                        <p className="mt-1 text-xs text-red-500" key={error}>
                          {error}
                        </p>
                      ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </fieldset>

        {/* START :: Flexbox for Color and Size */}
        <div className="flex gap-4">
          {/* Color Field - flex-1 */} 
          <div className="flex-1">
            <Label htmlFor="color">Color</Label>
            <Input
              id="color"
              name="color"
              defaultValue={state.cropVariety?.color ?? ''}
              aria-describedby="color-error"
              className="mt-1 w-full" // Keep w-full for input within its flex container
              placeholder="e.g., Red, Green, Yellow"
            />
            <div id="color-error" aria-live="polite" aria-atomic="true">
              {state.errors?.color &&
                state.errors.color.map((error: string) => (
                  <p className="mt-1 text-xs text-red-500" key={error}>
                    {error}
                  </p>
                ))}
            </div>
          </div>

          {/* Size Field - flex-1 */} 
          <div className="flex-1">
            <Label htmlFor="size">Size</Label>
            <Select name="size" defaultValue={state.cropVariety?.size ?? ''}>
              <SelectTrigger id="size" className="mt-1 w-full" aria-describedby="size-error"> {/* Keep w-full for trigger within its flex container */} 
                <SelectValue placeholder="Select size" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Small">Small</SelectItem>
                <SelectItem value="Medium">Medium</SelectItem>
                <SelectItem value="Large">Large</SelectItem>
              </SelectContent>
            </Select>
            <div id="size-error" aria-live="polite" aria-atomic="true">
              {state.errors?.size &&
                state.errors.size.map((error: string) => (
                  <p className="mt-1 text-xs text-red-500" key={error}>
                    {error}
                  </p>
                ))}
            </div>
          </div>
        </div>
         {/* END :: Flexbox for Color and Size */}

        {/* Disease Resistance Field - MOVED & REQUIRED */}
        <div>
          <Label htmlFor="disease_resistance">Disease Resistance</Label>
          <Input
            id="disease_resistance"
            name="disease_resistance"
            defaultValue={state.cropVariety?.disease_resistance ?? ''}
            aria-describedby="disease_resistance-error"
            className="mt-1"
            placeholder="e.g., Powdery Mildew, Blight"
            required
          />
          <div id="disease_resistance-error" aria-live="polite" aria-atomic="true">
            {state.errors?.disease_resistance &&
              state.errors.disease_resistance.map((error: string) => (
                <p className="mt-1 text-xs text-red-500" key={error}>
                  {error}
                </p>
              ))}
          </div>
        </div>

        {/* START :: Flexbox for Hybrid Status and Organic */}
        <div className="flex items-center gap-4">
          {/* Hybrid Status Field - MOVED & REQUIRED */}
          <div className="flex-1"> {/* Allow hybrid status to take more space */} 
            <Label htmlFor="hybrid_status">Hybrid Status</Label>
            <Select name="hybrid_status" defaultValue={state.cropVariety?.hybrid_status ?? ''} >
              <SelectTrigger id="hybrid_status" className="mt-1 w-full" aria-describedby="hybrid_status-error">
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Hybrid">Hybrid</SelectItem>
                <SelectItem value="Open Pollinated">Open Pollinated</SelectItem>
                <SelectItem value="Heirloom">Heirloom</SelectItem>
              </SelectContent>
            </Select>
            <div id="hybrid_status-error" aria-live="polite" aria-atomic="true">
              {state.errors?.hybrid_status &&
                state.errors.hybrid_status.map((error: string) => (
                  <p className="mt-1 text-xs text-red-500" key={error}>
                    {error}
                  </p>
                ))}
            </div>
          </div>

          {/* Organic Field - MOVED & Changed to Switch */}
          <div className="flex items-center space-x-2"> 
            {/* Replace Checkbox with Switch */}
            <div>
              {/* Hidden input to capture the value for form submission */}
              <input 
                type="hidden" 
                name="is_organic" 
                value={state.cropVariety?.is_organic ? "on" : "off"} 
              />
              <Switch
                id="is_organic"
                defaultChecked={state.cropVariety?.is_organic ?? false}
                onCheckedChange={(checked) => {
                  // Update the hidden input value when toggled
                  const input = document.querySelector('input[name="is_organic"]') as HTMLInputElement;
                  if (input) input.value = checked ? "on" : "off";
                }}
                aria-describedby="is_organic-error"
              />
            </div>
            <Label htmlFor="is_organic" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                Organic
            </Label>
             <div id="is_organic-error" aria-live="polite" aria-atomic="true">
              {/* Errors for checkbox are less common unless it's required */} 
              {state.errors?.is_organic &&
                state.errors.is_organic.map((error: string) => (
                  <p className="mt-1 text-xs text-red-500" key={error}>
                    {error}
                  </p>
                ))}
            </div>
          </div>
        </div>
        {/* END :: Flexbox for Hybrid Status and Organic */} 

      </fieldset>
      {/* END :: Characteristics Grouping */}

      {/* Notes Field */}
      <div>
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          name="notes"
          defaultValue={state.cropVariety?.notes ?? ''}
          aria-describedby="notes-error"
          className="mt-1"
          placeholder="Any additional notes about this variety..."
          rows={3}
        />
        <div id="notes-error" aria-live="polite" aria-atomic="true">
          {state.errors?.notes &&
            state.errors.notes.map((error: string) => (
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