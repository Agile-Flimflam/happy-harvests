import { z } from 'zod';

export const HarvestSchema = z.object({
  planting_id: z.preprocess(
    (v) => (typeof v === 'number' ? String(v) : v == null ? '' : v),
    z.string().regex(/^\d+$/, { message: 'Planting is required' }).transform((v) => parseInt(v, 10))
  ),
  event_date: z.preprocess(
    (v) => (v == null ? '' : v),
    z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'Date is required' })
  ),
  qty_harvested: z.preprocess(
    (v) => (v == null || v === '' ? null : typeof v === 'number' ? v : parseInt(String(v), 10)),
    z.number().int().positive().nullable().optional()
  ),
  weight_grams: z.preprocess(
    (v) => (v == null || v === '' ? null : typeof v === 'number' ? v : parseInt(String(v), 10)),
    z.number().int().positive().nullable().optional()
  ),
  quantity_unit: z.string().optional().nullable(),
}).refine((v) => (v.qty_harvested ?? 0) > 0 || (v.weight_grams ?? 0) > 0, {
  message: 'Provide quantity or weight',
  path: ['qty_harvested'],
});

export type HarvestInput = z.infer<typeof HarvestSchema>;
