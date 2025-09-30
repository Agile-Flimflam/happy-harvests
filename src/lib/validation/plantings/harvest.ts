import { z } from 'zod';

export const HarvestSchema = z.object({
  planting_id: z.coerce.number().int().positive(),
  event_date: z.string().regex(/\d{4}-\d{2}-\d{2}/, { message: 'Date is required (YYYY-MM-DD)' }),
  qty_harvested: z.coerce.number().int().positive().optional().nullable(),
  weight_grams: z.coerce.number().int().positive().optional().nullable(),
  quantity_unit: z.string().optional().nullable(),
}).refine((v) => (v.qty_harvested ?? 0) > 0 || (v.weight_grams ?? 0) > 0, {
  message: 'Provide quantity or weight',
  path: ['qty_harvested'],
});

export type HarvestInput = z.infer<typeof HarvestSchema>;
