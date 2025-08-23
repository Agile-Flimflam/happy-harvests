'use client';

import { useEffect, useRef, startTransition } from 'react';
import { useActionState } from 'react';
import { createLocation, updateLocation, type LocationFormState } from '../_actions';
import type { Tables } from '@/lib/supabase-server';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { DialogFooter, DialogClose } from '@/components/ui/dialog';
import { ExternalLink } from 'lucide-react';
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

type Location = Tables<'locations'>;

interface LocationFormProps {
  location?: Location | null;
  closeDialog: () => void;
}

function SubmitButton({ isEditing, submitting }: { isEditing: boolean; submitting: boolean }) {
  return (
    <Button type="submit" disabled={submitting} aria-disabled={submitting}>
      {submitting ? (isEditing ? 'Updating...' : 'Creating...') : (isEditing ? 'Update Location' : 'Create Location')}
    </Button>
  );
}

const usStates = new UsaStates();
const states = usStates.states;

export function LocationForm({ location, closeDialog }: LocationFormProps) {
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

  return (
    <Form {...form}>
      <form ref={formRef} onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-4">
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
          <legend className="text-sm font-medium px-1">Address</legend>

          <FormField
            control={form.control}
            name="street"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Street</FormLabel>
                <FormControl>
                  <Input {...field} value={field.value ?? ''} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

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
          <legend className="text-sm font-medium px-1">Coordinates</legend>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="latitude"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Latitude</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="any"
                      value={field.value != null ? String(field.value) : ''}
                      onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="longitude"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Longitude</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="any"
                      value={field.value != null ? String(field.value) : ''}
                      onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <div>
            <label className="text-sm font-medium" htmlFor="timezone">Timezone</label>
            <Input
              id="timezone"
              name="timezone"
              value={location?.timezone || state.location?.timezone || ''}
              placeholder="Will be detected when coordinates are provided"
              readOnly
              disabled
              className="mt-1 bg-muted text-muted-foreground cursor-not-allowed"
            />
            <p className="text-xs text-muted-foreground mt-1">Automatically set based on location coordinates</p>
          </div>
          <div className="flex justify-end">
            <Button type="button" variant="ghost" onClick={handleOpenInGoogleMaps}>
              <ExternalLink />
              Open in Google Maps
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


