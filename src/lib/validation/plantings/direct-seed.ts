import { z } from 'zod';

export const DirectSeedSchema = z.object({
  crop_variety_id: z.coerce.number().int().positive(),
  qty_initial: z.coerce.number().int().positive(),
  bed_id: z.coerce.number().int().positive(),
  event_date: z.string().regex(/\d{4}-\d{2}-\d{2}/, { message: 'Date is required (YYYY-MM-DD)' }),
  notes: z.string().optional().nullable(),
});

export type DirectSeedInput = z.infer<typeof DirectSeedSchema>;
