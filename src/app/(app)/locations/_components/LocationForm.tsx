'use client';

import { useEffect, useRef, startTransition, useMemo, useLayoutEffect, useCallback } from 'react';
import { useActionState } from 'react';
import { createLocation, updateLocation, type LocationFormState } from '../_actions';
import type { Tables } from '@/lib/supabase-server';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
// (Dialog footer handled by parent FormDialog)
import { ExternalLink, X, CheckCircle2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { UsaStates } from 'usa-states';
import { useForm, type SubmitHandler, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { LocationSchema, type LocationFormValues } from '@/lib/validation/locations';
import { 
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { AddressAutocomplete } from '@/components/locations/AddressAutocomplete';
import { MapPicker } from '@/components/locations/MapPicker';

type Location = Tables<'locations'>;

interface LocationFormProps {
  location?: Location | null;
  closeDialog: () => void;
  formId?: string;
}

const usStates = new UsaStates();
const states = usStates.states;

export function LocationForm({ location, closeDialog, formId }: LocationFormProps) {
  const isEditing = Boolean(location?.id);
  const action = isEditing ? updateLocation : createLocation;
  const initialState: LocationFormState = { message: '', errors: {}, location };
  const [state, dispatch] = useActionState(action, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  const form = useForm<LocationFormValues>({
    resolver: zodResolver(LocationSchema) as unknown as Resolver<LocationFormValues>,
    mode: 'onSubmit',
    defaultValues: {
      id: location?.id,
      name: location?.name ?? '',
      street: location?.street ?? '',
      city: location?.city ?? '',
      state: location?.state ?? '',
      zip: location?.zip ?? '',
      latitude: (location?.latitude ?? null) as number | null,
      longitude: (location?.longitude ?? null) as number | null,
      notes: location?.notes ?? '',
    },
  });

  const handleOpenInGoogleMaps = () => {
    const values = form.getValues();
    const name = (values.name ?? '').trim();
    const street = (values.street ?? '').trim();
    const city = (values.city ?? '').trim();
    const stateVal = (values.state ?? '').trim();
    const zip = (values.zip ?? '').trim();
    const latitude = typeof values.latitude === 'number' ? values.latitude : NaN;
    const longitude = typeof values.longitude === 'number' ? values.longitude : NaN;

    let url = '';

    if (!Number.isNaN(latitude) && !Number.isNaN(longitude)) {
      url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${latitude},${longitude}`)}`;
    } else {
      const parts = [street, city, stateVal, zip].filter(Boolean);
      const query = parts.length > 0 ? parts.join(' ') : name;
      if (query) {
        url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
      }
    }

    if (!url) {
      toast.info('Enter coordinates or address to open in Google Maps');
      return;
    }

    window.open(url, '_blank', 'noopener,noreferrer');
  };

  // Workaround for browser extensions that try to access form.control
  // Set up the form control property on the native form element before any inputs are rendered
  // This prevents browser extension errors when they try to access form.control
  // Using useLayoutEffect as backup in case callback ref doesn't run in time
  useLayoutEffect(() => {
    if (typeof window === 'undefined') return;

    // Try multiple times to ensure form is set up before extensions run
    const setupFormControl = () => {
      const formElement = formRef.current;
      if (!formElement) return false;

      // Add a dummy control property to prevent browser extension errors
      // This doesn't affect React Hook Form which uses its own context
      if (!('control' in formElement)) {
        Object.defineProperty(formElement, 'control', {
          value: {},
          writable: false,
          enumerable: false,
          configurable: true,
        });
      }
      return true;
    };

    // Try immediately
    setupFormControl();

    // Also try after microtasks to catch any async form setup
    const timeoutIds: NodeJS.Timeout[] = [];
    [0, 10, 50].forEach((delay) => {
      const id = setTimeout(() => {
        setupFormControl();
      }, delay);
      timeoutIds.push(id);
    });

    // Cleanup
    return () => {
      timeoutIds.forEach((id) => clearTimeout(id));
      const formElement = formRef.current;
      if (formElement && 'control' in formElement) {
        try {
          delete (formElement as { control?: unknown }).control;
        } catch {
          // Ignore errors during cleanup
        }
      }
    };
  }, []);

  useEffect(() => {
    if (state.message) {
      if (state.errors && Object.keys(state.errors).length > 0) {
        // Map server-side errors to RHF fields
        Object.entries(state.errors).forEach(([field, errors]) => {
          const message = Array.isArray(errors) ? errors[0] : (errors as unknown as string) || 'Invalid value';
          form.setError(field as keyof LocationFormValues, { message });
        });
        toast.error(state.message);
      } else {
        toast.success(state.message);
        closeDialog();
      }
    }
  }, [state, closeDialog, form]);

  // Watch form values for address preview and clear functionality
  const street = form.watch('street');
  const city = form.watch('city');
  const stateValue = form.watch('state');
  const zip = form.watch('zip');
  const latitude = form.watch('latitude');
  const longitude = form.watch('longitude');

  // Build address preview string
  const addressPreview = useMemo(() => {
    const parts = [street, city, stateValue, zip].filter(Boolean);
    return parts.length > 0 ? parts.join(', ') : null;
  }, [street, city, stateValue, zip]);

  // Check if address is complete
  const hasCompleteAddress = Boolean(street && city && stateValue && zip);
  const hasCoordinates = latitude != null && longitude != null;

  // Clear address function
  const handleClearAddress = () => {
    form.setValue('street', '');
    form.setValue('city', '');
    form.setValue('state', '');
    form.setValue('zip', '');
    form.setValue('latitude', null);
    form.setValue('longitude', null);
    form.clearErrors(['street', 'city', 'state', 'zip', 'latitude', 'longitude']);
    toast.info('Address cleared');
  };

  const onSubmit: SubmitHandler<LocationFormValues> = async (values) => {
    const fd = new FormData();
    if (isEditing && location?.id) fd.append('id', location.id);
    fd.append('name', values.name ?? '');
    fd.append('street', (values.street ?? '').toString());
    fd.append('city', (values.city ?? '').toString());
    fd.append('state', (values.state ?? '').toString());
    fd.append('zip', (values.zip ?? '').toString());
    fd.append('latitude', values.latitude != null ? String(values.latitude) : '');
    fd.append('longitude', values.longitude != null ? String(values.longitude) : '');
    fd.append('notes', (values.notes ?? '').toString());
    startTransition(() => {
      dispatch(fd);
    });
  };

  // Helper to set up form control property for browser extensions
  const setupFormControlOnRef = useCallback((formElement: HTMLFormElement | null) => {
    if (!formElement) return;
    
    // Add a dummy control property to prevent browser extension errors
    if (!('control' in formElement)) {
      Object.defineProperty(formElement, 'control', {
        value: {},
        writable: false,
        enumerable: false,
        configurable: true,
      });
    }
  }, []);

  return (
    <Form {...form}>
      <form
        id={formId}
        ref={(el) => {
          formRef.current = el;
          // Set up form control property as soon as form is available
          setupFormControlOnRef(el);
        }}
        onSubmit={form.handleSubmit(onSubmit)}
        noValidate
        className="space-y-4"
      >
        {isEditing && <input type="hidden" name="id" value={location?.id} />}

        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <fieldset className="border p-4 rounded-md space-y-3">
          <div className="flex items-center justify-between">
            <legend className="text-sm font-medium px-1">Address</legend>
            {hasCompleteAddress && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleClearAddress}
                className="h-7 text-xs"
              >
                <X className="h-3 w-3" />
                Clear address
              </Button>
            )}
          </div>

          <FormField
            control={form.control}
            name="street"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Street Address</FormLabel>
                <FormControl>
                  <AddressAutocomplete field={field} placeholder="Start typing an address..." />
                </FormControl>
                <FormMessage />
                <p className="text-xs text-muted-foreground">
                  Start typing a street address (suggestions appear after a few characters). Selected address will auto-populate all fields below.
                </p>
              </FormItem>
            )}
          />

          {/* Address Preview */}
          {addressPreview && (
            <div className="flex items-start gap-2 rounded-md border bg-muted/50 p-3 text-sm">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-primary mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground">Selected Address</p>
                <p className="text-muted-foreground break-words">{addressPreview}</p>
                {hasCoordinates && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Coordinates: {latitude?.toFixed(6)}, {longitude?.toFixed(6)}
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <FormField
              control={form.control}
              name="city"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>City</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value ?? ''} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="state"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>State</FormLabel>
                  <FormControl>
                    <Select value={field.value ?? ''} onValueChange={field.onChange}>
                      <SelectTrigger className="mt-1 w-full">
                        <SelectValue placeholder="Select a state" />
                      </SelectTrigger>
                      <SelectContent>
                        {states.map((stateData) => (
                          <SelectItem key={stateData.abbreviation} value={stateData.abbreviation}>
                            {stateData.name}
                          </SelectItem>
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
              name="zip"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Zip</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value ?? ''} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </fieldset>

        <fieldset className="border p-4 rounded-md space-y-3">
          <legend className="text-sm font-medium px-1">Location & Coordinates</legend>
          
          <div className="space-y-3">
            <MapPicker height="h-[300px] sm:h-[400px]" />
            <p className="text-xs text-muted-foreground">
              {hasCoordinates
                ? 'Drag the marker or click on the map to update coordinates. Coordinates will auto-update when you select an address above.'
                : 'Click on the map or select an address above to set coordinates.'}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div>
              <label className="text-sm font-medium" htmlFor="latitude-display">Latitude</label>
              {hasCoordinates ? (
                <Input
                  id="latitude-display"
                  name="latitude-display"
                  value={latitude != null ? String(latitude) : ''}
                  placeholder="Not set"
                  readOnly
                  disabled
                  className="mt-1 bg-muted text-muted-foreground cursor-not-allowed"
                />
              ) : (
                <Skeleton className="h-9 w-full mt-1" />
              )}
            </div>
            <div>
              <label className="text-sm font-medium" htmlFor="longitude-display">Longitude</label>
              {hasCoordinates ? (
                <Input
                  id="longitude-display"
                  name="longitude-display"
                  value={longitude != null ? String(longitude) : ''}
                  placeholder="Not set"
                  readOnly
                  disabled
                  className="mt-1 bg-muted text-muted-foreground cursor-not-allowed"
                />
              ) : (
                <Skeleton className="h-9 w-full mt-1" />
              )}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium" htmlFor="timezone">Timezone</label>
            {location?.timezone || state.location?.timezone ? (
              <Input
                id="timezone"
                name="timezone"
                value={location?.timezone || state.location?.timezone || ''}
                placeholder="Will be detected when coordinates are provided"
                readOnly
                disabled
                className="mt-1 bg-muted text-muted-foreground cursor-not-allowed"
              />
            ) : (
              <Skeleton className="h-9 w-full mt-1" />
            )}
            <p className="text-xs text-muted-foreground mt-1">
              {hasCoordinates
                ? 'Will be automatically detected when location is saved'
                : 'Automatically set based on location coordinates'}
            </p>
          </div>
          
          <div className="flex flex-col sm:flex-row justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={handleOpenInGoogleMaps}
              disabled={!hasCoordinates && !addressPreview}
              className="w-full sm:w-auto"
            >
              <ExternalLink className="h-4 w-4" />
              <span className="hidden sm:inline">Open in Google Maps</span>
              <span className="sm:hidden">Google Maps</span>
            </Button>
          </div>
        </fieldset>

        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notes</FormLabel>
              <FormControl>
                <Textarea rows={3} {...field} value={field.value ?? ''} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Footer handled by parent DialogLayout */}
      </form>
    </Form>
  );
}


