import { z } from 'zod';

export const RemoveSchema = z.object({
  planting_id: z.coerce.number().int().positive(),
  event_date: z.string().regex(/\d{4}-\d{2}-\d{2}/, { message: 'Date is required (YYYY-MM-DD)' }),
  reason: z.string().optional().nullable(),
});

export type RemoveInput = z.infer<typeof RemoveSchema>;
