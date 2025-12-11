'use client';

import { useEffect, useLayoutEffect, useRef, useState, startTransition } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { useActionState } from 'react';
import Image from 'next/image';
import {
  createCropVariety,
  updateCropVariety,
  type Crop,
  type CropVarietyFormState,
  createCropSimple,
  type SimpleCropFormState,
} from '../_actions';
import type { Tables } from '@/lib/supabase-server';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
  DialogDescription,
} from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Constants } from '@/lib/database.types';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod/dist/zod';
import { CropVarietySchema, type CropVarietyFormValues } from '@/lib/validation/crop-varieties';
import { Plus, X } from 'lucide-react';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { setupFormControlProperty, setupGlobalFormControlListener } from '@/lib/form-utils';

type CropVariety = Tables<'crop_varieties'> & {
  crops?: { name: string } | null;
  image_url: string | null;
};

interface CropVarietyFormProps {
  cropVariety?: CropVariety | null;
  crops?: Crop[];
  closeDialog: () => void;
  formId?: string;
  defaultCropId?: number | null;
  defaultIsOrganic?: boolean;
  onCreated?: (variety: CropVariety) => void;
}

/**
 * Validates blob URL format for preview images created with URL.createObjectURL().
 * Validates that the blob URL follows the expected format (blob:origin/uuid).
 * Rejects malicious blob URLs like blob:javascript:alert(1) by ensuring the origin
 * doesn't contain dangerous protocols.
 */
function isValidBlobUrl(url: string): boolean {
  if (!url.startsWith('blob:')) {
    return false;
  }
  try {
    const withoutScheme = url.slice('blob:'.length);
    const slashIndex = withoutScheme.indexOf('/');
    if (slashIndex <= 0) return false;
    const originPart = withoutScheme.slice(0, slashIndex).trim();
    const pathPart = withoutScheme.slice(slashIndex + 1);

    // Ensure there is a UUID/path portion after the origin
    if (!originPart || !pathPart) return false;

    // blob:null/<uuid> is valid for opaque origins; do not attempt to parse "null" as a URL
    if (originPart.toLowerCase() === 'null') return true;

    // Require an explicit allowed protocol (http/https) before parsing to URL
    const hasAllowedProtocolPrefix = /^https?:/i.test(originPart);
    if (!hasAllowedProtocolPrefix) return false;

    const originUrl = new URL(originPart);
    return originUrl.protocol === 'http:' || originUrl.protocol === 'https:';
  } catch {
    // Invalid URL format - reject (this catches blob:javascript:alert(1) type attacks)
    return false;
  }
}

/**
 * Validates image URL structure and restricts allowed protocols to http: or https: for database URLs (from Supabase storage).
 * This helps reduce XSS risk by preventing javascript: and data: URLs, but complete XSS prevention
 * requires additional measures like Content-Security-Policy headers and proper encoding.
 */
function isValidImageUrl(url: string | null | undefined): url is string {
  if (!url || typeof url !== 'string') {
    return false;
  }

  try {
    const parsedUrl = new URL(url);
    // Only allow http: or https: protocols for database URLs
    return parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:';
  } catch {
    // Invalid URL format
    return false;
  }
}

/**
 * Strips HTML tag delimiters to ensure user-provided text stays as plain text.
 * Prevents DOM text from being reinterpreted as HTML when rendered downstream.
 */
function sanitizePlainText(value: string): string {
  return value.replace(/[<>]/g, '');
}

function sanitizeInlineCropForm(event: FormEvent<HTMLFormElement>) {
  const formEl = event.currentTarget;
  const nameInput = formEl.elements.namedItem('name') as HTMLInputElement | null;
  const cropTypeInput = formEl.elements.namedItem('crop_type') as HTMLInputElement | null;

  if (nameInput) {
    nameInput.value = sanitizePlainText(nameInput.value);
  }
  if (cropTypeInput) {
    cropTypeInput.value = sanitizePlainText(cropTypeInput.value);
  }
}

export function CropVarietyForm({
  cropVariety,
  crops = [],
  closeDialog,
  formId,
  defaultCropId = null,
  defaultIsOrganic = false,
  onCreated,
}: CropVarietyFormProps) {
  const isEditing = Boolean(cropVariety?.id);
  // Update action functions
  const action = isEditing ? updateCropVariety : createCropVariety;
  // Update initial state type and property name
  const initialState: CropVarietyFormState = { message: '', errors: {}, cropVariety: cropVariety };
  const [state, dispatch] = useActionState(action, initialState);
  const [cropsLocal, setCropsLocal] = useState<Crop[]>(crops ?? []);
  const [isCropDialogOpen, setIsCropDialogOpen] = useState(false);
  const [newCropType, setNewCropType] = useState<string>('');
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [removeExistingImage, setRemoveExistingImage] = useState(false);
  const mainFormRef = useRef<HTMLFormElement>(null);
  const inlineCropFormRef = useRef<HTMLFormElement>(null);

  const handleImageChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    if (file) {
      const url = URL.createObjectURL(file);
      setImagePreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return url;
      });
      setRemoveExistingImage(false);
    } else {
      setImagePreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
    }
  };

  const handleClearSelectedImage = () => {
    const inputEl = document.getElementById('image') as HTMLInputElement | null;
    if (inputEl) {
      inputEl.value = '';
    }
    setImagePreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  };

  const defaultValues: Partial<CropVarietyFormValues> = {
    id: cropVariety?.id,
    crop_id: cropVariety?.crop_id ?? defaultCropId ?? undefined,
    name: cropVariety?.name ?? '',
    latin_name: cropVariety?.latin_name ?? '',
    is_organic: cropVariety?.is_organic ?? defaultIsOrganic ?? false,
    notes: cropVariety?.notes ?? '',
    dtm_direct_seed_min: cropVariety?.dtm_direct_seed_min ?? undefined,
    dtm_direct_seed_max: cropVariety?.dtm_direct_seed_max ?? undefined,
    dtm_transplant_min: cropVariety?.dtm_transplant_min ?? undefined,
    dtm_transplant_max: cropVariety?.dtm_transplant_max ?? undefined,
    plant_spacing_min: cropVariety?.plant_spacing_min ?? null,
    plant_spacing_max: cropVariety?.plant_spacing_max ?? null,
    row_spacing_min: cropVariety?.row_spacing_min ?? null,
    row_spacing_max: cropVariety?.row_spacing_max ?? null,
  };

  const formResolver = zodResolver<CropVarietyFormValues>(CropVarietySchema);

  const form = useForm<CropVarietyFormValues>({
    resolver: formResolver,
    mode: 'onSubmit',
    defaultValues,
  });

  // Inline crop create action
  const inlineInitial: SimpleCropFormState = { message: '', errors: {}, crop: null };
  const [cropCreateState, createCropAction] = useActionState(createCropSimple, inlineInitial);

  useEffect(() => {
    if (state.message) {
      if (state.errors && Object.keys(state.errors).length > 0) {
        // Set server errors on form fields
        const formFields = [
          'id',
          'crop_id',
          'name',
          'latin_name',
          'is_organic',
          'notes',
          'dtm_direct_seed_min',
          'dtm_direct_seed_max',
          'dtm_transplant_min',
          'dtm_transplant_max',
          'plant_spacing_min',
          'plant_spacing_max',
          'row_spacing_min',
          'row_spacing_max',
        ] as const;
        const isFormFieldKey = (key: string): key is (typeof formFields)[number] =>
          formFields.includes(key as (typeof formFields)[number]);
        Object.entries(state.errors).forEach(([field, errors]) => {
          if (!isFormFieldKey(field)) return;
          const errorArray = Array.isArray(errors) ? errors : [errors];
          form.setError(field, {
            message: errorArray[0],
          });
        });
        toast.error(state.message);
      } else {
        // Success toast
        toast.success(state.message);
        if (!isEditing && state.cropVariety && onCreated) {
          onCreated(state.cropVariety);
        }
        closeDialog(); // Close dialog on success
      }
    }
  }, [state, closeDialog, form, isEditing, onCreated]);

  useEffect(() => {
    setCropsLocal(crops ?? []);
  }, [crops]);

  useEffect(() => {
    if (cropCreateState.message) {
      if (cropCreateState.errors && Object.keys(cropCreateState.errors).length > 0) {
        toast.error(cropCreateState.message);
      } else if (cropCreateState.crop) {
        // Update local crops and select the new one
        const newCrop = cropCreateState.crop;
        setCropsLocal((prev) => {
          const next = [...prev, newCrop];
          return next.sort((a, b) => a.name.localeCompare(b.name));
        });
        const createdId = newCrop.id;
        form.setValue('crop_id', createdId);
        toast.success(cropCreateState.message);
        setIsCropDialogOpen(false);
      }
    }
  }, [cropCreateState, form]);

  // Ensure form.control exists for browser extensions on both forms
  useLayoutEffect(() => {
    if (mainFormRef.current) {
      setupFormControlProperty(mainFormRef.current);
    }
  }, []);

  useLayoutEffect(() => {
    if (isCropDialogOpen && inlineCropFormRef.current) {
      setupFormControlProperty(inlineCropFormRef.current);
    }
  }, [isCropDialogOpen]);

  // Global safety for aggressive browser extensions
  useEffect(() => {
    setupGlobalFormControlListener();
  }, []); // run once on mount to avoid duplicate listeners

  const onSubmit = async (values: CropVarietyFormValues) => {
    const cropId = Number(values.crop_id);
    if (!Number.isFinite(cropId) || cropId <= 0) {
      form.setError('crop_id', { message: 'Please select a crop' });
      toast.error('Please select a crop');
      return;
    }
    const sanitizedName = sanitizePlainText(values.name);
    const sanitizedLatinName = sanitizePlainText(values.latin_name);
    const sanitizedNotes = sanitizePlainText(values.notes ?? '');
    const fd = new FormData();
    if (isEditing && cropVariety?.id) fd.append('id', String(cropVariety.id));
    fd.append('crop_id', String(cropId));
    fd.append('name', sanitizedName);
    fd.append('latin_name', sanitizedLatinName);
    fd.append('is_organic', values.is_organic ? 'on' : 'off');
    fd.append('notes', sanitizedNotes);
    if (values.dtm_direct_seed_min != null) {
      fd.append('dtm_direct_seed_min', String(values.dtm_direct_seed_min));
    }
    if (values.dtm_direct_seed_max != null) {
      fd.append('dtm_direct_seed_max', String(values.dtm_direct_seed_max));
    }
    if (values.dtm_transplant_min != null) {
      fd.append('dtm_transplant_min', String(values.dtm_transplant_min));
    }
    if (values.dtm_transplant_max != null) {
      fd.append('dtm_transplant_max', String(values.dtm_transplant_max));
    }
    if (values.plant_spacing_min != null) {
      fd.append('plant_spacing_min', String(values.plant_spacing_min));
    }
    if (values.plant_spacing_max != null) {
      fd.append('plant_spacing_max', String(values.plant_spacing_max));
    }
    if (values.row_spacing_min != null) {
      fd.append('row_spacing_min', String(values.row_spacing_min));
    }
    if (values.row_spacing_max != null) {
      fd.append('row_spacing_max', String(values.row_spacing_max));
    }
    const inputEl = document.getElementById('image') as HTMLInputElement | null;
    if (inputEl && inputEl.files && inputEl.files[0]) {
      fd.append('image', inputEl.files[0]);
    }
    fd.append('remove_image', removeExistingImage ? 'on' : 'off');

    startTransition(() => {
      dispatch(fd);
    });
  };

  // Compute existing image URL safely
  // image_url is a computed property added by getCropVarieties, not in the base database type
  const stateCropVariety: CropVariety | null = state.cropVariety ?? cropVariety ?? null;
  const existingImageUrl =
    !imagePreviewUrl && !removeExistingImage && stateCropVariety
      ? stateCropVariety.image_url
      : null;
  const safeExistingImageUrl =
    existingImageUrl && isValidImageUrl(existingImageUrl) ? existingImageUrl : null;

  return (
    <TooltipProvider>
      <Form {...form}>
        <form
          id={formId}
          ref={mainFormRef}
          onSubmit={form.handleSubmit(onSubmit)}
          className="space-y-4"
        >
          {/* Hidden input for ID if editing */}
          {isEditing && <input type="hidden" name="id" value={cropVariety?.id} />}

          {/* Crop Selection */}
          <FormField
            control={form.control}
            name="crop_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Crop</FormLabel>
                <div className="flex gap-2">
                  <FormControl>
                    <Select
                      onValueChange={(value) => field.onChange(parseInt(value, 10))}
                      value={field.value ? field.value.toString() : ''}
                    >
                      <SelectTrigger>
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
                  </FormControl>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => setIsCropDialogOpen(true)}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Add new crop</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Variety Information */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Name Field */}
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Variety Name</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Latin Name Field */}
            <FormField
              control={form.control}
              name="latin_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Latin Name</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Organic Toggle */}
            <FormField
              control={form.control}
              name="is_organic"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Organic</FormLabel>
                  <FormControl>
                    <div className="flex items-center h-10">
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* Image */}
          <div>
            <Label htmlFor="image">Image</Label>
            <div className="flex items-start gap-4 mt-1">
              {imagePreviewUrl && isValidBlobUrl(imagePreviewUrl) && (
                <div className="relative inline-block h-20 w-20">
                  <Image
                    src={imagePreviewUrl}
                    alt="Selected image preview"
                    fill
                    className="rounded border object-cover"
                    unoptimized
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="absolute -top-2 -right-2 h-6 w-6 rounded-full p-0"
                    onClick={handleClearSelectedImage}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}
              {safeExistingImageUrl && (
                <div className="relative inline-block h-20 w-20">
                  <Image
                    src={safeExistingImageUrl}
                    alt="Current variety image"
                    fill
                    className="rounded border object-cover"
                    unoptimized
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="absolute -top-2 -right-2 h-6 w-6 rounded-full p-0"
                    onClick={() => {
                      setRemoveExistingImage(true);
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}
              <div className="flex-1">
                <Label htmlFor="image" className="cursor-pointer block">
                  <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg h-20 flex flex-col items-center justify-center text-center hover:border-muted-foreground/50 transition-colors">
                    <div className="mx-auto h-6 w-6 text-muted-foreground mb-1">
                      <svg
                        className="h-full w-full"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                        />
                      </svg>
                    </div>
                    <span className="text-xs font-medium text-primary hover:text-primary/80">
                      Choose image
                    </span>
                  </div>
                </Label>
                <Input
                  id="image"
                  name="image"
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={handleImageChange}
                />
              </div>
            </div>
          </div>

          {/* Days to Maturity */}
          <div className="border rounded-lg p-4 space-y-3">
            <h3 className="text-sm font-medium">Days to Maturity</h3>
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="dtm_direct_seed_min"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Direct Seed Min</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        className="h-8"
                        {...field}
                        value={field.value?.toString() ?? ''}
                        onChange={(e) =>
                          field.onChange(e.target.value ? Number(e.target.value) : undefined)
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="dtm_direct_seed_max"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Direct Seed Max</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        className="h-8"
                        {...field}
                        value={field.value?.toString() ?? ''}
                        onChange={(e) =>
                          field.onChange(e.target.value ? Number(e.target.value) : undefined)
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="dtm_transplant_min"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Transplant Min</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        className="h-8"
                        {...field}
                        value={field.value?.toString() ?? ''}
                        onChange={(e) =>
                          field.onChange(e.target.value ? Number(e.target.value) : undefined)
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="dtm_transplant_max"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Transplant Max</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        className="h-8"
                        {...field}
                        value={field.value?.toString() ?? ''}
                        onChange={(e) =>
                          field.onChange(e.target.value ? Number(e.target.value) : undefined)
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>

          {/* Plant Spacing */}
          <div className="border rounded-lg p-4 space-y-3">
            <h3 className="text-sm font-medium">Plant Spacing (cm)</h3>
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="plant_spacing_min"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Plant Min</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        className="h-8"
                        {...field}
                        value={field.value?.toString() ?? ''}
                        onChange={(e) =>
                          field.onChange(e.target.value ? Number(e.target.value) : null)
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="plant_spacing_max"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Plant Max</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        className="h-8"
                        {...field}
                        value={field.value?.toString() ?? ''}
                        onChange={(e) =>
                          field.onChange(e.target.value ? Number(e.target.value) : null)
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="row_spacing_min"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Row Min</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        className="h-8"
                        {...field}
                        value={field.value?.toString() ?? ''}
                        onChange={(e) =>
                          field.onChange(e.target.value ? Number(e.target.value) : null)
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="row_spacing_max"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Row Max</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        className="h-8"
                        {...field}
                        value={field.value?.toString() ?? ''}
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
          </div>

          {/* Notes - Full width */}
          <FormField
            control={form.control}
            name="notes"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Notes</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Additional notes about this variety..."
                    rows={4}
                    {...field}
                    value={field.value ?? ''}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </form>
      </Form>
      {/* Add Crop Dialog moved OUTSIDE the main form to avoid nested validation */}
      <Dialog open={isCropDialogOpen} onOpenChange={setIsCropDialogOpen}>
        <DialogContent className="sm:max-w-[425px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New Crop</DialogTitle>
            <DialogDescription>Enter the crop name and type to add it.</DialogDescription>
          </DialogHeader>
          <form
            ref={inlineCropFormRef}
            action={createCropAction}
            className="space-y-4"
            onSubmit={sanitizeInlineCropForm}
          >
            <div>
              <Label htmlFor="new_crop_name">Name</Label>
              <Input
                id="new_crop_name"
                name="name"
                required
                className="mt-1"
                aria-describedby="new_crop_name-error"
              />
            </div>
            <div>
              <Label htmlFor="new_crop_type">Type</Label>
              <Select defaultValue={''} onValueChange={setNewCropType}>
                <SelectTrigger
                  id="new_crop_type"
                  className="mt-1"
                  aria-describedby="new_crop_type-error"
                >
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {(Constants.public.Enums.crop_type as readonly string[])
                    .slice()
                    .sort((a, b) => a.localeCompare(b))
                    .map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              {/* Hidden input to actually submit crop_type since shadcn Select isn't a native input */}
              <input type="hidden" name="crop_type" value={newCropType} />
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline" type="button">
                  Cancel
                </Button>
              </DialogClose>
              <Button type="submit">Create</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}
