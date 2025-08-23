import { z } from 'zod';
import type { Enums } from '@/lib/supabase-server';

export type PlantingType = Enums<'planting_type'>;
export type PlantingStatus = Enums<'bed_planting_status'>;

export const PlantingSchema = z.object({
  id: z.coerce.number().int().optional(),
  crop_variety_id: z.coerce.number().int({ message: 'Plant Variety selection is required' }),
  bed_id: z.coerce.number().int({ message: 'Bed selection is required' }),
  planting_type: z.custom<PlantingType>(),
  qty_planting: z.coerce.number().int().positive({ message: 'Quantity must be positive' }),
  date_planted: z.string().regex(/\d{4}-\d{2}-\d{2}/, { message: 'Date is required' }),
  harvested_date: z.string().regex(/\d{4}-\d{2}-\d{2}/).nullable().optional(),
  status: z.custom<PlantingStatus>(),
  notes: z.string().optional().nullable(),
});

export type PlantingFormValues = z.infer<typeof PlantingSchema>;


