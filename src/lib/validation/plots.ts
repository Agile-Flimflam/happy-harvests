import { z } from 'zod';

export const PlotSchema = z.object({
  plot_id: z.number().int().optional(),
  name: z.string().min(1, { message: 'Name is required' }),
  location_id: z.string().uuid({ message: 'Location is required' }),
});

export type PlotFormValues = z.infer<typeof PlotSchema>;

const bulkCountSchema = z.coerce
  .number()
  .int({ message: 'Count must be a whole number' })
  .min(1, { message: 'Add at least one item' })
  .max(50, { message: 'Limit bulk add to 50 at a time' });

export const BulkPlotSchema = z.object({
  location_id: z.string().uuid({ message: 'Location is required' }),
  base_name: z
    .string()
    .min(1, { message: 'Name prefix required' })
    .max(120, { message: 'Name prefix too long' }),
  count: bulkCountSchema,
});

export type BulkPlotFormValues = z.infer<typeof BulkPlotSchema>;

export const BedSchema = z.object({
  id: z.number().int().optional(),
  plot_id: z.coerce.number().int({ message: 'Plot selection is required' }),
  length_inches: z.coerce.number().int().positive().optional().nullable(),
  width_inches: z.coerce.number().int().positive().optional().nullable(),
  name: z.string().max(120).optional().nullable(),
});

export type BedFormValues = z.infer<typeof BedSchema>;

export const BedSizeSchema = z.object({
  length_inches: z.coerce.number().int().positive({ message: 'Length required' }),
  width_inches: z.coerce.number().int().positive({ message: 'Width required' }),
});

export const BulkBedSchema = z.object({
  location_id: z.string().uuid({ message: 'Location is required' }),
  plot_id: z.coerce.number().int({ message: 'Plot selection is required' }),
  base_name: z
    .string()
    .min(1, { message: 'Name prefix required' })
    .max(120, { message: 'Name prefix too long' })
    .optional(),
  count: bulkCountSchema,
  unit: z.literal('in'),
  size: BedSizeSchema,
});

export type BulkBedFormValues = z.infer<typeof BulkBedSchema>;
