'use client';

import { useEffect, useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import Fraction from 'fraction.js'; // Import fraction.js
import { createBed, updateBed, type BedFormState } from '@/app/actions/beds';
import type { Tables } from '@/lib/supabase';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"; // Select for plot_id
import { Textarea } from "@/components/ui/textarea"; // Import Textarea
import { toast } from "sonner";
import { DialogFooter, DialogClose } from "@/components/ui/dialog";

type Bed = Tables<'beds'>;
type Plot = Tables<'plots'>;

interface BedFormProps {
  bed?: Bed | null;
  plots: Plot[]; // Need list of plots for the dropdown
  closeDialog: () => void;
}

function SubmitButton({ isEditing }: { isEditing: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} aria-disabled={pending}>
      {pending ? (isEditing ? 'Updating...' : 'Creating...') : (isEditing ? 'Update Bed' : 'Create Bed')}
    </Button>
  );
}

export function BedForm({ bed, plots, closeDialog }: BedFormProps) {
  const isEditing = Boolean(bed?.id);
  const action = isEditing ? updateBed : createBed;
  const initialState: BedFormState = { message: '', errors: {}, bed: bed };
  const [state, dispatch] = useFormState(action, initialState);

  // State to track input values for dynamic area calculation
  const [currentLength, setCurrentLength] = useState<string>(bed?.length_in?.toString() ?? '');
  const [currentWidth, setCurrentWidth] = useState<string>(bed?.width_in?.toString() ?? '');

  // Update local state if the bed prop changes (e.g., opening edit dialog)
  useEffect(() => {
    setCurrentLength(bed?.length_in?.toString() ?? '');
    setCurrentWidth(bed?.width_in?.toString() ?? '');
  }, [bed]);

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

  return (
    <form action={dispatch} className="space-y-4">
      {isEditing && <input type="hidden" name="id" value={bed?.id} />}

      {/* Plot Select Field */}
      <div>
        <Label htmlFor="plot_id">Plot</Label>
        <Select name="plot_id" defaultValue={state.bed?.plot_id ?? ''} required>
            <SelectTrigger id="plot_id" aria-describedby="plot_id-error" className="mt-1">
                <SelectValue placeholder="Select a plot" />
            </SelectTrigger>
            <SelectContent>
                {plots.map((plot) => (
                    <SelectItem key={plot.id} value={plot.id}>
                        {plot.name}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
         <div id="plot_id-error" aria-live="polite" aria-atomic="true">
          {state.errors?.plot_id &&
            state.errors.plot_id.map((error: string) => (
              <p className="mt-1 text-xs text-red-500" key={error}>{error}</p>
            ))}
        </div>
      </div>

      {/* Bed Name Field */}
      <div>
        <Label htmlFor="name">Bed Name</Label>
        <Input
          id="name"
          name="name"
          defaultValue={state.bed?.name ?? ''}
          required
          aria-describedby="name-error"
          className="mt-1"
        />
         <div id="name-error" aria-live="polite" aria-atomic="true">
          {state.errors?.name &&
            state.errors.name.map((error: string) => (
              <p className="mt-1 text-xs text-red-500" key={error}>{error}</p>
            ))}
        </div>
      </div>

      {/* Dimensions Section using Fieldset */}
      <fieldset className="border p-4 rounded-md space-y-4">
        <legend className="text-sm font-medium px-1">Dimensions</legend>

        {/* Combined Length and Width Fields */}
        <div className="flex items-start gap-4">
          {/* Length Field (Half Width) */}
          <div className="flex-1">
            <Label htmlFor="length_in">Length (in)</Label>
            <Input
              id="length_in"
              name="length_in"
              type="number"
              value={currentLength}
              onChange={(e) => setCurrentLength(e.target.value)}
              aria-describedby="length_in-error"
              className="mt-1"
            />
            <div id="length_in-error" aria-live="polite" aria-atomic="true">
              {state.errors?.length_in &&
                state.errors.length_in.map((error: string) => (
                  <p className="mt-1 text-xs text-red-500" key={error}>{error}</p>
                ))}
            </div>
          </div>

          {/* Width Field (Half Width) */}
          <div className="flex-1">
            <Label htmlFor="width_in">Width (in)</Label>
            <Input
              id="width_in"
              name="width_in"
              type="number"
              value={currentWidth}
              onChange={(e) => setCurrentWidth(e.target.value)}
              aria-describedby="width_in-error"
              className="mt-1"
            />
            <div id="width_in-error" aria-live="polite" aria-atomic="true">
              {state.errors?.width_in &&
                state.errors.width_in.map((error: string) => (
                  <p className="mt-1 text-xs text-red-500" key={error}>{error}</p>
                ))}
            </div>
          </div>
        </div>

        {/* Combined Calculated Area and Acreage Displays */}
        <div className="flex items-start gap-4">
          {/* Display Calculated Area (Half Width) */}
          <div className="flex-1">
            <Label>Calculated Area</Label>
            <p className="text-sm text-muted-foreground mt-1">
              {(() => {
                const lengthNum = parseFloat(currentLength);
                const widthNum = parseFloat(currentWidth);
                if (!isNaN(lengthNum) && !isNaN(widthNum) && lengthNum > 0 && widthNum > 0) {
                  const areaSqIn = lengthNum * widthNum;
                  const areaSqFt = areaSqIn / 144;
                  return `${areaSqFt.toFixed(0)} sq ft`;
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
                const lengthNum = parseFloat(currentLength);
                const widthNum = parseFloat(currentWidth);
                if (!isNaN(lengthNum) && !isNaN(widthNum) && lengthNum > 0 && widthNum > 0) {
                  const areaSqIn = lengthNum * widthNum;
                  const areaSqFt = areaSqIn / 144;
                  const acreage = areaSqFt / 43560;
                  if (acreage === 0) return '0 acres';
                  // Use fraction.js - toFraction(true) attempts simplification
                  const frac = new Fraction(acreage);
                  return `${frac.toFraction(true)} acres`;
                }
                return '-';
              })()}
            </p>
          </div>
        </div>
      </fieldset>

      {/* Notes Field */}
      <div>
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          name="notes"
          placeholder="Add any notes about this bed..."
          defaultValue={state.bed?.notes ?? ''}
          aria-describedby="notes-error"
          className="mt-1"
        />
         <div id="notes-error" aria-live="polite" aria-atomic="true">
          {state.errors?.notes &&
            state.errors.notes.map((error: string) => (
              <p className="mt-1 text-xs text-red-500" key={error}>{error}</p>
            ))}
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