import { z } from 'zod';

export const UpdateNurserySchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1, { message: 'Name is required' }),
  location_id: z.string().uuid({ message: 'Location is required' }),
  notes: z.string().optional().nullable(),
});

export type UpdateNurseryInput = z.infer<typeof UpdateNurserySchema>;
