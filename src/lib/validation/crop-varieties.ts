import { z } from 'zod';

export const CropVarietySchema = z.object({
  id: z.coerce.number().int().optional(),
  crop_id: z.coerce.number({ message: 'Please select a crop' }).int({ message: 'Please select a crop' }),
  name: z.string().min(1, { message: 'Name is required' }),
  latin_name: z.string().min(1, { message: 'Latin name is required' }),
  is_organic: z.boolean().default(false),
  notes: z.string().optional().nullable(),
  dtm_direct_seed_min: z.coerce.number({ message: 'Please enter a valid number' }).int({ message: 'Must be a whole number' }).nonnegative({ message: 'Must be 0 or greater' }),
  dtm_direct_seed_max: z.coerce.number({ message: 'Please enter a valid number' }).int({ message: 'Must be a whole number' }).nonnegative({ message: 'Must be 0 or greater' }),
  dtm_transplant_min: z.coerce.number({ message: 'Please enter a valid number' }).int({ message: 'Must be a whole number' }).nonnegative({ message: 'Must be 0 or greater' }),
  dtm_transplant_max: z.coerce.number({ message: 'Please enter a valid number' }).int({ message: 'Must be a whole number' }).nonnegative({ message: 'Must be 0 or greater' }),
  plant_spacing_min: z.coerce.number({ message: 'Please enter a valid number' }).int({ message: 'Must be a whole number' }).nonnegative({ message: 'Must be 0 or greater' }).nullable(),
  plant_spacing_max: z.coerce.number({ message: 'Please enter a valid number' }).int({ message: 'Must be a whole number' }).nonnegative({ message: 'Must be 0 or greater' }).nullable(),
  row_spacing_min: z.coerce.number({ message: 'Please enter a valid number' }).int({ message: 'Must be a whole number' }).nonnegative({ message: 'Must be 0 or greater' }).nullable(),
  row_spacing_max: z.coerce.number({ message: 'Please enter a valid number' }).int({ message: 'Must be a whole number' }).nonnegative({ message: 'Must be 0 or greater' }).nullable(),
}).refine(data => data.dtm_direct_seed_min <= data.dtm_direct_seed_max, {
  message: 'Direct seed min must be less than or equal to max',
  path: ['dtm_direct_seed_max']
}).refine(data => data.dtm_transplant_min <= data.dtm_transplant_max, {
  message: 'Transplant min must be less than or equal to max',
  path: ['dtm_transplant_max']
});

export type CropVarietyFormValues = z.infer<typeof CropVarietySchema>;

export const SimpleCropSchema = z.object({
  name: z.string().min(1, { message: 'Name is required' }),
  crop_type: z.enum(['Vegetable', 'Fruit', 'Windbreak', 'Covercrop'], { message: 'Crop type is required' }),
});

export type SimpleCropValues = z.infer<typeof SimpleCropSchema>;
