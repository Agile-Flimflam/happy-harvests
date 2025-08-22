'use client';

import { useEffect, useState } from 'react';
import { useActionState } from 'react';
import { createCropVariety, updateCropVariety, type CropVarietyFormState, createCropSimple, type SimpleCropFormState } from '../_actions';
import type { Tables } from '@/lib/supabase-server';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner"; // Assuming sonner for toasts
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Constants } from '@/lib/database.types';
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type CropVariety = Tables<'crop_varieties'> & { crops?: { name: string } | null };
type Crop = { id: number; name: string };

interface CropVarietyFormProps {
  cropVariety?: CropVariety | null;
  crops?: Crop[];
  closeDialog: () => void;
  formId?: string;
}

// Removed unused SubmitButton component

export function CropVarietyForm({ cropVariety, crops = [], closeDialog, formId }: CropVarietyFormProps) {
  const isEditing = Boolean(cropVariety?.id);
  // Update action functions
  const action = isEditing ? updateCropVariety : createCropVariety;
  // Update initial state type and property name
  const initialState: CropVarietyFormState = { message: '', errors: {}, cropVariety: cropVariety };
  const [state, dispatch] = useActionState(action, initialState);
  const [cropsLocal, setCropsLocal] = useState<Crop[]>(crops);
  const [selectedCropId, setSelectedCropId] = useState<string>(state.cropVariety?.crop_id?.toString() ?? '');
  const [isCropDialogOpen, setIsCropDialogOpen] = useState(false);

  // Inline crop create action
  const inlineInitial: SimpleCropFormState = { message: '', errors: {}, crop: null };
  const [cropCreateState, createCropAction] = useActionState(createCropSimple, inlineInitial);

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

  useEffect(() => {
    if (cropCreateState.message) {
      if (cropCreateState.errors && Object.keys(cropCreateState.errors).length > 0) {
        toast.error(cropCreateState.message);
      } else if (cropCreateState.crop) {
        // Update local crops and select the new one
        setCropsLocal((prev) => {
          const next = [...prev, cropCreateState.crop as unknown as Crop];
          return next.sort((a, b) => a.name.localeCompare(b.name));
        });
        setSelectedCropId((cropCreateState.crop.id as unknown as number).toString());
        toast.success(cropCreateState.message);
        setIsCropDialogOpen(false);
      }
    }
  }, [cropCreateState]);

  return (
    <TooltipProvider>
      <form action={dispatch} id={formId} className="space-y-4">
        {/* Hidden input for ID if editing */}
        {isEditing && <input type="hidden" name="id" value={cropVariety?.id} />}

      {/* Crop Selection */}
      <div>
        <Label htmlFor="crop_id">Crop</Label>
        <div className="flex gap-2 mt-1">
          <Select name="crop_id" value={selectedCropId} onValueChange={setSelectedCropId}>
            <SelectTrigger id="crop_id" aria-describedby="crop_id-error">
              <SelectValue placeholder="Select crop" />
            </SelectTrigger>
            <SelectContent>
              {cropsLocal.map((c) => (
                <SelectItem key={c.id} value={c.id.toString()}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
                      <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  type="button" 
                  variant="outline" 
                  size="icon"
                  onClick={() => setIsCropDialogOpen(true)}
                >
                  +
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Add new crop</p>
              </TooltipContent>
            </Tooltip>
        </div>
        <div id="crop_id-error" aria-live="polite" aria-atomic="true">
          {state.errors?.crop_id &&
            state.errors.crop_id.map((error: string) => (
              <p className="mt-1 text-xs text-red-500" key={error}>
                {error}
              </p>
            ))}
        </div>
      </div>

      {/* Variety Information */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Name Field */}
        <div>
          <Label htmlFor="name">Variety Name</Label>
          <Input
            id="name"
            name="name"
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

        {/* Latin Name Field */}
        <div>
          <Label htmlFor="latin_name">Latin Name</Label>
          <Input
            id="latin_name"
            name="latin_name"
            defaultValue={state.cropVariety?.latin_name ?? ''}
            aria-describedby="latin_name-error"
            className="mt-1"
            required
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

        {/* Organic Toggle */}
        <div>
          <Label htmlFor="is_organic">Organic</Label>
          <div className="mt-1 flex items-center h-10">
            <input 
              type="hidden" 
              name="is_organic" 
              value={state.cropVariety?.is_organic ? "on" : "off"} 
            />
            <Switch
              id="is_organic"
              defaultChecked={state.cropVariety?.is_organic ?? false}
              onCheckedChange={(checked) => {
                const input = document.querySelector('input[name="is_organic"]') as HTMLInputElement;
                if (input) input.value = checked ? "on" : "off";
              }}
            />
          </div>
        </div>
      </div>

      {/* Image */}
      <div>
        <Label htmlFor="image">Image</Label>
        <div className="flex items-start gap-4 mt-1">
          {state.cropVariety && (state.cropVariety as unknown as { image_url?: string | null })?.image_url && (
            <div className="relative inline-block">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={(state.cropVariety as unknown as { image_url?: string | null }).image_url as string}
                alt="Current variety image"
                className="h-20 w-20 rounded border object-cover"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="absolute -top-2 -right-2 h-6 w-6 rounded-full p-0"
                onClick={() => {
                  const input = document.querySelector('input[name="remove_image"]') as HTMLInputElement;
                  if (input) input.value = "on";
                  // Hide the image preview
                  const imageContainer = document.querySelector('.relative.inline-block') as HTMLElement;
                  if (imageContainer) imageContainer.style.display = 'none';
                }}
              >
                ×
              </Button>
              <input type="hidden" name="remove_image" value="off" />
            </div>
          )}
          <div className="flex-1">
            <Label htmlFor="image" className="cursor-pointer block">
              <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg h-20 flex flex-col items-center justify-center text-center hover:border-muted-foreground/50 transition-colors">
                <div className="mx-auto h-6 w-6 text-muted-foreground mb-1">
                  <svg className="h-full w-full" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                </div>
                <span className="text-xs font-medium text-primary hover:text-primary/80">Choose image</span>
              </div>
            </Label>
            <Input 
              id="image" 
              name="image" 
              type="file" 
              accept="image/*"
              className="sr-only"
            />
          </div>
        </div>
      </div>

      {/* Inline Add Crop Dialog */}
      <Dialog open={isCropDialogOpen} onOpenChange={setIsCropDialogOpen}>
        <DialogContent className="sm:max-w-[425px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New Crop</DialogTitle>
          </DialogHeader>
          <form action={createCropAction} className="space-y-4">
            <div>
              <Label htmlFor="new_crop_name">Name</Label>
              <Input id="new_crop_name" name="name" required className="mt-1" aria-describedby="new_crop_name-error" />
            </div>
            <div>
              <Label htmlFor="new_crop_type">Type</Label>
              <Select name="crop_type" defaultValue="" required>
                <SelectTrigger id="new_crop_type" className="mt-1" aria-describedby="new_crop_type-error">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {(Constants.public.Enums.crop_type as readonly string[])
                    .slice()
                    .sort((a, b) => a.localeCompare(b))
                    .map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline" type="button">Cancel</Button>
              </DialogClose>
              <Button type="submit">Create</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Days to Maturity */}
      <div className="border rounded-lg p-4 space-y-3">
        <h3 className="text-sm font-medium">Days to Maturity</h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="dtm_direct_seed_min" className="text-xs">Direct Seed Min</Label>
            <Input
              id="dtm_direct_seed_min"
              name="dtm_direct_seed_min"
              type="number"
              defaultValue={state.cropVariety?.dtm_direct_seed_min ?? ''}
              className="h-8"
              required
            />
          </div>
          <div>
            <Label htmlFor="dtm_direct_seed_max" className="text-xs">Direct Seed Max</Label>
            <Input
              id="dtm_direct_seed_max"
              name="dtm_direct_seed_max"
              type="number"
              defaultValue={state.cropVariety?.dtm_direct_seed_max ?? ''}
              className="h-8"
              required
            />
          </div>
          <div>
            <Label htmlFor="dtm_transplant_min" className="text-xs">Transplant Min</Label>
            <Input
              id="dtm_transplant_min"
              name="dtm_transplant_min"
              type="number"
              defaultValue={state.cropVariety?.dtm_transplant_min ?? ''}
              className="h-8"
              required
            />
          </div>
          <div>
            <Label htmlFor="dtm_transplant_max" className="text-xs">Transplant Max</Label>
            <Input
              id="dtm_transplant_max"
              name="dtm_transplant_max"
              type="number"
              defaultValue={state.cropVariety?.dtm_transplant_max ?? ''}
              className="h-8"
              required
            />
          </div>
        </div>
      </div>

      {/* Plant Spacing */}
      <div className="border rounded-lg p-4 space-y-3">
        <h3 className="text-sm font-medium">Plant Spacing (cm)</h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="plant_spacing_min" className="text-xs">Plant Min</Label>
            <Input 
              id="plant_spacing_min" 
              name="plant_spacing_min" 
              type="number" 
              defaultValue={state.cropVariety?.plant_spacing_min ?? ''} 
              className="h-8" 
            />
          </div>
          <div>
            <Label htmlFor="plant_spacing_max" className="text-xs">Plant Max</Label>
            <Input 
              id="plant_spacing_max" 
              name="plant_spacing_max" 
              type="number" 
              defaultValue={state.cropVariety?.plant_spacing_max ?? ''} 
              className="h-8" 
            />
          </div>
          <div>
            <Label htmlFor="row_spacing_min" className="text-xs">Row Min</Label>
            <Input 
              id="row_spacing_min" 
              name="row_spacing_min" 
              type="number" 
              defaultValue={state.cropVariety?.row_spacing_min ?? ''} 
              className="h-8" 
            />
          </div>
          <div>
            <Label htmlFor="row_spacing_max" className="text-xs">Row Max</Label>
            <Input 
              id="row_spacing_max" 
              name="row_spacing_max" 
              type="number" 
              defaultValue={state.cropVariety?.row_spacing_max ?? ''} 
              className="h-8" 
            />
          </div>
        </div>
      </div>

      {/* Notes - Full width */}
      <div>
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          name="notes"
          defaultValue={state.cropVariety?.notes ?? ''}
          className="mt-1"
          placeholder="Additional notes about this variety..."
          rows={4}
        />
      </div>

      {/* Server Action Message Display */}
      {/* Removed direct message display, handled by toast */}

      {/* Footer moved to parent dialog to keep it locked while body scrolls */}
    </form>
    </TooltipProvider>
  );
}


