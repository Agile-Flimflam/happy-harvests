import { z } from 'zod';

export const NurserySowSchema = z.object({
  crop_variety_id: z.coerce.number().int().positive(),
  qty_initial: z.coerce.number().int().positive(),
  nursery_id: z.string().uuid({ message: 'Nursery is required' }),
  event_date: z.string().regex(/\d{4}-\d{2}-\d{2}/, { message: 'Date is required (YYYY-MM-DD)' }),
  notes: z.string().optional().nullable(),
});

export type NurserySowInput = z.infer<typeof NurserySowSchema>;
