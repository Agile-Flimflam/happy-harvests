/**
 * Validates and normalizes the Mapbox access token from environment variables.
 * Returns a valid token string or null if the token is missing, empty, or invalid.
 * 
 * @returns The validated token string, or null if invalid
 */
export function getValidatedMapboxToken(): string | null {
  const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
  
  // Explicitly check for undefined, null, or empty/whitespace-only strings
  if (!token || typeof token !== 'string' || token.trim().length === 0) {
    return null;
  }
  
  return token;
}

