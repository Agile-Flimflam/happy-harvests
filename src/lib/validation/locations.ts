import { z } from 'zod';
import { MIN_LATITUDE, MAX_LATITUDE, MIN_LONGITUDE, MAX_LONGITUDE } from '@/lib/geo-constants';

const hasValue = (value: string | null | undefined): boolean => {
  return value != null && value.trim() !== '';
};

const isValidCoordinateValue = (coord: number | null | undefined): coord is number => {
  return coord != null && typeof coord === 'number' && !Number.isNaN(coord);
};

/**
 * Validates that a coordinate pair (latitude, longitude) is within valid WGS84 ranges.
 * This is a shared utility to ensure consistent validation across the codebase.
 *
 * @param latitude - The latitude value to validate
 * @param longitude - The longitude value to validate
 * @returns true if both coordinates are valid numbers within WGS84 ranges, false otherwise
 */
export function isValidCoordinatePair(
  latitude: number | null | undefined,
  longitude: number | null | undefined
): boolean {
  // Check that both values are numbers, not NaN, and within valid ranges
  return (
    typeof latitude === 'number' &&
    !Number.isNaN(latitude) &&
    latitude >= MIN_LATITUDE &&
    latitude <= MAX_LATITUDE &&
    typeof longitude === 'number' &&
    !Number.isNaN(longitude) &&
    longitude >= MIN_LONGITUDE &&
    longitude <= MAX_LONGITUDE
  );
}

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
        z.coerce
          .number()
          .min(MIN_LATITUDE, { message: `Latitude must be >= ${MIN_LATITUDE}` })
          .max(MAX_LATITUDE, { message: `Latitude must be <= ${MAX_LATITUDE}` }),
        z.null(),
      ])
      .optional(),
    longitude: z
      .union([
        z.coerce
          .number()
          .min(MIN_LONGITUDE, { message: `Longitude must be >= ${MIN_LONGITUDE}` })
          .max(MAX_LONGITUDE, { message: `Longitude must be <= ${MAX_LONGITUDE}` }),
        z.null(),
      ])
      .optional(),
    notes: z.string().optional().nullable(),
  })
  .superRefine((data, ctx) => {
    // Helper to check coordinate state
    const hasLatitude = isValidCoordinateValue(data.latitude);
    const hasLongitude = isValidCoordinateValue(data.longitude);
    const coordinatesAreValidPair = isValidCoordinatePair(data.latitude, data.longitude);

    // Check if we have a complete address (indicating Mapbox selection)
    const hasCompleteAddress =
      hasValue(data.street) && hasValue(data.city) && hasValue(data.state) && hasValue(data.zip);

    // If complete address is provided (Mapbox selection), coordinates should be set
    if (hasCompleteAddress && !coordinatesAreValidPair) {
      // Only show this error if both coordinates are missing to avoid duplicate messages.
      // If only one is missing, the coordinate pair validation below will handle it.
      if (!hasLatitude && !hasLongitude) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            'Coordinates are missing for the selected address. Please try selecting the address again or set coordinates manually on the map.',
          path: ['latitude'],
        });
      }
    }

    // Validate coordinate pairs: if one is set, the other should be set too
    // This validation runs regardless of address completeness to provide complete feedback
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
