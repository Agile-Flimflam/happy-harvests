import { z } from 'zod'

const nonEmpty = (msg: string) => z.string().transform((v) => (v ?? '').toString().trim()).refine((v) => v.length > 0, { message: msg })

export const CustomerSchema = z.object({
  id: z.string().uuid().optional(),
  name: nonEmpty('Name is required'),
  email: z
    .string()
    .trim()
    .optional()
    .or(z.literal('').transform(() => undefined))
    .or(z.null().transform(() => undefined)),
  phone: z.string().optional().nullable(),
  fax: z.string().optional().nullable(),
  website: z
    .string()
    .trim()
    .optional()
    .or(z.literal('').transform(() => undefined))
    .or(z.null().transform(() => undefined)),
  billing_street: z.string().optional().nullable(),
  billing_city: z.string().optional().nullable(),
  billing_state: z.string().optional().nullable(),
  billing_zip: z.string().optional().nullable(),
  shipping_street: z.string().optional().nullable(),
  shipping_city: z.string().optional().nullable(),
  shipping_state: z.string().optional().nullable(),
  shipping_zip: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
})

export type CustomerFormValues = z.infer<typeof CustomerSchema>


