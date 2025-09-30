import { z } from 'zod';

export const NurserySowSchema = z.object({
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
  nursery_id: z.preprocess(
    (v) => (v == null ? '' : v),
    z.string().uuid({ message: 'Nursery is required' })
  ),
  event_date: z.preprocess(
    (v) => (v == null ? '' : v),
    z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'Date is required' })
  ),
  notes: z.string().optional().nullable(),
});

export type NurserySowInput = z.infer<typeof NurserySowSchema>;
