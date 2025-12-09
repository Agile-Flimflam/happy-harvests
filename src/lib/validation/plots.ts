import { z } from 'zod';

export const PlotSchema = z.object({
  plot_id: z.number().int().optional(),
  name: z.string().min(1, { message: 'Name is required' }),
  location_id: z.string().uuid({ message: 'Location is required' }),
});

export type PlotFormValues = z.infer<typeof PlotSchema>;

export const BedSchema = z.object({
  id: z.number().int().optional(),
  plot_id: z.coerce.number().int({ message: 'Plot selection is required' }),
  length_inches: z.coerce.number().int().positive().optional().nullable(),
  width_inches: z.coerce.number().int().positive().optional().nullable(),
  name: z.string().max(120).optional().nullable(),
});

export type BedFormValues = z.infer<typeof BedSchema>;
