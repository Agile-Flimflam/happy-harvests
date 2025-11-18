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

    // Helper to check if a coordinate is valid (not null, not undefined, and is a valid number)
    const isValidCoordinate = (coord: number | null | undefined): boolean => {
      return coord != null && typeof coord === 'number' && !Number.isNaN(coord);
    };

    // Check if we have a complete address (indicating Mapbox selection)
    const hasCompleteAddress =
      hasValue(data.street) &&
      hasValue(data.city) &&
      hasValue(data.state) &&
      hasValue(data.zip);

    // If complete address is provided (Mapbox selection), coordinates should be set
    if (hasCompleteAddress) {
      // Check if coordinates are missing (null or undefined)
      const hasLatitude = isValidCoordinate(data.latitude);
      const hasLongitude = isValidCoordinate(data.longitude);

      if (!hasLatitude || !hasLongitude) {
        // Add error to latitude field only to avoid duplicate messages in UI
        // The message mentions "coordinates" (plural) so it's clear it applies to both fields
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Coordinates are missing for the selected address. Please try selecting the address again or set coordinates manually on the map.',
          path: ['latitude'],
        });
        // Return early to avoid duplicate validation errors
        return;
      }
    }

    // Validate coordinate pairs: if one is set, the other should be set too
    const hasLatitude = isValidCoordinate(data.latitude);
    const hasLongitude = isValidCoordinate(data.longitude);

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


