import { z } from 'zod'

export const DeliveryItemSchema = z.object({
  crop_variety_id: z.coerce.number().int().optional(),
  planting_id: z.coerce.number().int().optional(),
  qty: z.coerce.number().positive({ message: 'Quantity must be > 0' }),
  unit: z.string().min(1),
  price_per: z.coerce.number().nonnegative().optional(),
  total_price: z.coerce.number().nonnegative().optional(),
  notes: z.string().optional().nullable(),
})

export const DeliverySchema = z.object({
  id: z.string().uuid().optional(),
  customer_id: z.string().uuid({ message: 'Select a customer' }),
  delivery_date: z.string().min(1, { message: 'Date is required' }),
  status: z.string().optional().nullable(),
  payment_terms: z.string().optional().nullable(),
  payment_status: z
    .enum([
      'open',              // the invoice has an open balance
      'sent',              // you emailed the invoice to the customer
      'partially_paid',    // your customer made a partial payment
      'paid',              // your customer paid the invoice in full
      'deposited',         // the bank deposit for the invoice payment is recorded
      'not_deposited',     // invoice is paid, deposit not recorded
      'voided',            // the invoice was voided
    ])
    .optional()
    .nullable(),
  notes: z.string().optional().nullable(),
  items: z.array(DeliveryItemSchema).min(1, { message: 'Add at least one item' }),
})

export type DeliveryFormValues = z.infer<typeof DeliverySchema>


