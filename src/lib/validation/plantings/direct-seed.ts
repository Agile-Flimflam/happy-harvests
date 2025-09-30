import { z } from 'zod';

export const DirectSeedSchema = z.object({
  crop_variety_id: z.preprocess(
    (v) => (typeof v === 'number' ? String(v) : v == null ? '' : v),
    z
      .string()
      .regex(/^\d+$/, { message: 'Variety is required' })
      .transform((v) => parseInt(v, 10))
  ),
  qty_initial: z.preprocess(
    (v) => (typeof v === 'number' ? String(v) : v == null ? '' : v),
    z
      .string()
      .regex(/^\d+$/, { message: 'Quantity is required' })
      .transform((v) => parseInt(v, 10))
  ),
  bed_id: z.preprocess(
    (v) => (typeof v === 'number' ? String(v) : v == null ? '' : v),
    z
      .string()
      .regex(/^\d+$/, { message: 'Bed is required' })
      .transform((v) => parseInt(v, 10))
  ),
  event_date: z.preprocess(
    (v) => (v == null ? '' : v),
    z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'Date is required' })
  ),
  notes: z.string().optional().nullable(),
  weight_grams: z.preprocess(
    (v) => (v == null || v === '' ? null : typeof v === 'number' ? v : parseInt(String(v), 10)),
    z.number().int().positive().nullable().optional()
  ),
});

export type DirectSeedInput = z.infer<typeof DirectSeedSchema>;
