import { z } from 'zod'

export const SeedSchema = z.object({
  id: z.number().int().optional(),
  crop_variety_id: z.union([z.coerce.number().int(), z.literal(''), z.null()]).optional(),
  crop_name: z.string().min(1, { message: 'Crop name is required' }),
  variety_name: z.string().min(1, { message: 'Variety is required' }),
  vendor: z.string().optional().nullable(),
  lot_number: z.string().optional().nullable(),
  date_received: z.string().optional().nullable(),
  quantity: z.union([z.coerce.number().int().min(0), z.literal(''), z.null()]).optional(),
  quantity_units: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
})

export type SeedFormValues = z.infer<typeof SeedSchema>


