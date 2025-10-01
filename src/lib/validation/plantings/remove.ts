import { z } from 'zod';

export const RemoveSchema = z.object({
  planting_id: z.preprocess(
    (v) => (typeof v === 'number' ? String(v) : v == null ? '' : v),
    z.string().regex(/^\d+$/, { message: 'Planting is required' }).transform((v) => parseInt(v, 10))
  ),
  event_date: z.preprocess(
    (v) => (v == null ? '' : v),
    z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'Date is required' })
  ),
  reason: z.string().optional().nullable(),
});

export type RemoveInput = z.infer<typeof RemoveSchema>;
