import { z } from 'zod';

// Base schema that accepts Mapbox geocoding response format
// Mapbox returns: street (address_line1), city (address_level2), state (address_level1), 
// zip (postal_code), latitude, longitude (from geometry.coordinates)
export const LocationSchema = z
  .object({
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
  })
  .superRefine((data, ctx) => {
    // Helper to check if a value is truthy (not null, undefined, or empty string)
    const hasValue = (value: string | null | undefined): boolean => {
      return value != null && value.trim() !== '';
    };

    // Check if we have a complete address (indicating Mapbox selection)
    const hasCompleteAddress =
      hasValue(data.street) &&
      hasValue(data.city) &&
      hasValue(data.state) &&
      hasValue(data.zip);

    // If complete address is provided (Mapbox selection), coordinates should be set
    if (hasCompleteAddress) {
      if (data.latitude == null || data.longitude == null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Coordinates are required when a complete address is selected. Please select an address or set coordinates on the map.',
          path: ['latitude'], // Attach to latitude field
        });
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Coordinates are required when a complete address is selected. Please select an address or set coordinates on the map.',
          path: ['longitude'], // Also attach to longitude field
        });
      } else {
        // Validate that both coordinates are valid numbers
        if (typeof data.latitude !== 'number' || Number.isNaN(data.latitude)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Latitude must be a valid number',
            path: ['latitude'],
          });
        }
        if (typeof data.longitude !== 'number' || Number.isNaN(data.longitude)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Longitude must be a valid number',
            path: ['longitude'],
          });
        }
      }
    }

    // Validate coordinate pairs: if one is set, the other should be set too
    const hasLatitude = data.latitude != null && typeof data.latitude === 'number' && !Number.isNaN(data.latitude);
    const hasLongitude = data.longitude != null && typeof data.longitude === 'number' && !Number.isNaN(data.longitude);

    if (hasLatitude && !hasLongitude) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Longitude is required when latitude is provided',
        path: ['longitude'],
      });
    }

    if (hasLongitude && !hasLatitude) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Latitude is required when longitude is provided',
        path: ['latitude'],
      });
    }
  });

export type LocationFormValues = z.infer<typeof LocationSchema>;


