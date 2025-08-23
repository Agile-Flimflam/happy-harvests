import { z } from 'zod';

export const LocationSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1, { message: 'Name is required' }),
  street: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  state: z.string().optional().nullable(),
  zip: z.string().optional().nullable(),
  latitude: z
    .union([
      z.coerce.number().min(-90, { message: 'Latitude must be >= -90' }).max(90, { message: 'Latitude must be <= 90' }),
      z.null(),
    ])
    .optional(),
  longitude: z
    .union([
      z.coerce.number().min(-180, { message: 'Longitude must be >= -180' }).max(180, { message: 'Longitude must be <= 180' }),
      z.null(),
    ])
    .optional(),
  notes: z.string().optional().nullable(),
});

export type LocationFormValues = z.infer<typeof LocationSchema>;


