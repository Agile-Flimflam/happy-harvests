'use client';

import { useEffect } from 'react';
import { useRef } from 'react';
import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { createLocation, updateLocation, type LocationFormState } from '../_actions';
import type { Tables } from '@/lib/supabase-server';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { DialogFooter, DialogClose } from '@/components/ui/dialog';
import { ExternalLink } from 'lucide-react';

type Location = Tables<'locations'>;

interface LocationFormProps {
  location?: Location | null;
  closeDialog: () => void;
}

function SubmitButton({ isEditing }: { isEditing: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} aria-disabled={pending}>
      {pending ? (isEditing ? 'Updating...' : 'Creating...') : (isEditing ? 'Update Location' : 'Create Location')}
    </Button>
  );
}

export function LocationForm({ location, closeDialog }: LocationFormProps) {
  const isEditing = Boolean(location?.id);
  const action = isEditing ? updateLocation : createLocation;
  const initialState: LocationFormState = { message: '', errors: {}, location };
  const [state, dispatch] = useActionState(action, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  const handleOpenInGoogleMaps = () => {
    const formElement = formRef.current;
    if (!formElement) return;

    const formData = new FormData(formElement);
    const getValue = (key: string) => String(formData.get(key) ?? '').trim();

    const name = getValue('name');
    const street = getValue('street');
    const city = getValue('city');
    const stateVal = getValue('state');
    const zip = getValue('zip');
    const latStr = getValue('latitude');
    const lngStr = getValue('longitude');

    const latitude = parseFloat(latStr);
    const longitude = parseFloat(lngStr);

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
    <form ref={formRef} action={dispatch} className="space-y-4">
      {isEditing && <input type="hidden" name="id" value={location?.id} />}

      <div>
        <Label htmlFor="name">Name</Label>
        <Input id="name" name="name" defaultValue={state.location?.name ?? ''} required aria-describedby="name-error" className="mt-1" />
        <div id="name-error" aria-live="polite" aria-atomic="true">
          {state.errors?.name && state.errors.name.map((error: string) => (
            <p className="mt-1 text-xs text-red-500" key={error}>{error}</p>
          ))}
        </div>
      </div>

      <fieldset className="border p-4 rounded-md space-y-3">
        <legend className="text-sm font-medium px-1">Address</legend>
        <div>
          <Label htmlFor="street">Street</Label>
          <Input id="street" name="street" defaultValue={state.location?.street ?? ''} className="mt-1" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <Label htmlFor="city">City</Label>
            <Input id="city" name="city" defaultValue={state.location?.city ?? ''} className="mt-1" />
          </div>
          <div>
            <Label htmlFor="state">State</Label>
            <Input id="state" name="state" defaultValue={state.location?.state ?? ''} className="mt-1" />
          </div>
          <div>
            <Label htmlFor="zip">Zip</Label>
            <Input id="zip" name="zip" defaultValue={state.location?.zip ?? ''} className="mt-1" />
          </div>
        </div>
      </fieldset>

      <fieldset className="border p-4 rounded-md space-y-3">
        <legend className="text-sm font-medium px-1">Coordinates</legend>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="latitude">Latitude</Label>
            <Input id="latitude" name="latitude" type="number" step="any" defaultValue={state.location?.latitude ?? ''} aria-describedby="latitude-error" className="mt-1" />
            <div id="latitude-error" aria-live="polite" aria-atomic="true">
              {state.errors?.latitude && state.errors.latitude.map((error: string) => (
                <p className="mt-1 text-xs text-red-500" key={error}>{error}</p>
              ))}
            </div>
          </div>
          <div>
            <Label htmlFor="longitude">Longitude</Label>
            <Input id="longitude" name="longitude" type="number" step="any" defaultValue={state.location?.longitude ?? ''} aria-describedby="longitude-error" className="mt-1" />
            <div id="longitude-error" aria-live="polite" aria-atomic="true">
              {state.errors?.longitude && state.errors.longitude.map((error: string) => (
                <p className="mt-1 text-xs text-red-500" key={error}>{error}</p>
              ))}
            </div>
          </div>
        </div>
        <div className="flex justify-end">
          <Button type="button" variant="ghost" onClick={handleOpenInGoogleMaps}>
            <ExternalLink />
            Open in Google Maps
          </Button>
        </div>
      </fieldset>

      <div>
        <Label htmlFor="notes">Notes</Label>
        <Textarea id="notes" name="notes" defaultValue={state.location?.notes ?? ''} className="mt-1" rows={3} />
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


