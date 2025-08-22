'use client';

import { useEffect } from 'react';
import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { createPlot, updatePlot, type PlotFormState } from '../_actions';
import type { Tables } from '@/lib/supabase-server';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { DialogFooter, DialogClose } from "@/components/ui/dialog";

type Plot = Tables<'plots'>;
type Location = Tables<'locations'>;

interface PlotFormProps {
  plot?: Plot | null;
  locations: Location[];
  closeDialog: () => void;
}

function SubmitButton({ isEditing }: { isEditing: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} aria-disabled={pending}>
      {pending ? (isEditing ? 'Updating...' : 'Creating...') : (isEditing ? 'Update Plot' : 'Create Plot')}
    </Button>
  );
}

export function PlotForm({ plot, locations, closeDialog }: PlotFormProps) {
  const isEditing = Boolean(plot?.plot_id);
  const action = isEditing ? updatePlot : createPlot;
  const initialState: PlotFormState = { message: '', errors: {}, plot: plot };
  const [state, dispatch] = useActionState(action, initialState);

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
      {isEditing && <input type="hidden" name="plot_id" value={plot?.plot_id} />}
      <div>
        <Label htmlFor="name">Name</Label>
        <Input
          id="name"
          name="name"
          defaultValue={state.plot?.name ?? ''}
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
      <div>
        <Label htmlFor="location_id">Location</Label>
        <select
          id="location_id"
          name="location_id"
          defaultValue={state.plot?.location_id ?? ''}
          required
          className="mt-1 block w-full border rounded-md px-3 py-2 text-sm bg-background"
          aria-describedby="location_id-error"
        >
          <option value="">— Unassigned —</option>
          {locations.map((loc) => (
            <option key={loc.id} value={loc.id}>
              {loc.name}
            </option>
          ))}
        </select>
        <div id="location_id-error" aria-live="polite" aria-atomic="true">
          {state.errors?.location_id &&
            state.errors.location_id.map((error: string) => (
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
