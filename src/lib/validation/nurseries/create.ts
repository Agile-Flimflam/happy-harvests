import { z } from 'zod';

export const CreateNurserySchema = z.object({
  name: z.string().min(1, { message: 'Name is required' }),
  location_id: z.string().uuid({ message: 'Location is required' }),
  notes: z.string().optional().nullable(),
});

export type CreateNurseryInput = z.infer<typeof CreateNurserySchema>;
