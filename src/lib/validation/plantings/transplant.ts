import { z } from 'zod';

export const TransplantSchema = z.object({
  planting_id: z.coerce.number().int().positive(),
  bed_id: z.coerce.number().int().positive(),
  event_date: z.string().regex(/\d{4}-\d{2}-\d{2}/, { message: 'Date is required (YYYY-MM-DD)' }),
});

export type TransplantInput = z.infer<typeof TransplantSchema>;
