import { z } from 'zod';
import { ACTIVITY_TYPES_ENUM } from '@/lib/activities/types';

export const ActivitySchema = z.object({
  activity_type: z.enum(ACTIVITY_TYPES_ENUM),
  started_at: z
    .string()
    .min(1, { message: 'Start time is required' })
    .transform((s) => s.replace(' ', 'T')),
  ended_at: z
    .string()
    .transform((s) => (s ? s.replace(' ', 'T') : s))
    .optional()
    .nullable(),
  duration_minutes: z.coerce
    .number()
    .finite({ message: 'Must be a valid finite number' })
    .int()
    .min(0)
    .optional()
    .nullable(),
  labor_hours: z.coerce
    .number()
    .finite({ message: 'Must be a valid finite number' })
    .min(0)
    .optional()
    .nullable(),
  location_id: z.string().uuid().optional().nullable(),
  plot_id: z.coerce
    .number()
    .finite({ message: 'Must be a valid finite number' })
    .int()
    .optional()
    .nullable(),
  bed_id: z.coerce
    .number()
    .finite({ message: 'Must be a valid finite number' })
    .int()
    .optional()
    .nullable(),
  nursery_id: z.string().uuid().optional().nullable(),
  crop: z.string().optional().nullable(),
  asset_id: z.string().optional().nullable(),
  asset_name: z.string().optional().nullable(),
  quantity: z.coerce
    .number()
    .finite({ message: 'Must be a valid finite number' })
    .min(0)
    .optional()
    .nullable(),
  unit: z.string().optional().nullable(),
  cost: z.coerce
    .number()
    .finite({ message: 'Must be a valid finite number' })
    .min(0)
    .optional()
    .nullable(),
  notes: z.string().optional().nullable(),
  amendments: z
    .array(
      z.object({
        name: z.string().min(1),
        quantity: z.coerce
          .number()
          .finite({ message: 'Amendment quantity must be a valid finite number' })
          .optional()
          .nullable(),
        unit: z.string().optional().nullable(),
        notes: z.string().optional().nullable(),
      })
    )
    .optional()
    .nullable(),
});

export type ActivityFormValues = z.infer<typeof ActivitySchema>;
