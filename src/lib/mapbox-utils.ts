/**
 * Validates and normalizes the Mapbox access token from environment variables.
 * Returns a valid token string or null if the token is missing, empty, or invalid.
 * 
 * SECURITY WARNING: This function returns a token that will be embedded in client-side code.
 * This is required for mapbox-gl to function, but the token will be visible in the browser.
 * 
 * Security requirements:
 * - MUST use a Mapbox PUBLIC token (not a secret token)
 * - MUST configure URL restrictions in Mapbox dashboard
 * - MUST set minimal scopes (only: styles:read, fonts:read, sprites:read)
 * - MUST NOT include uploads, datasets, or other write permissions
 * - MUST monitor usage in Mapbox dashboard
 * - MUST rotate tokens regularly
 * 
 * NOTE: This function works in both server and client contexts because Next.js
 * embeds `NEXT_PUBLIC_` prefixed environment variables at build time, making them
 * available in client-side code. The variable is replaced with its actual value
 * during the build process, so `process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` is
 * accessible in client components.
 * 
 * @returns The validated token string, or null if invalid
 */
export function getValidatedMapboxToken(): string | null {
  // NEXT_PUBLIC_ prefixed variables are embedded at build time and available in client-side code
  const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
  
  // Explicitly check for undefined, null, or empty/whitespace-only strings
  if (!token || typeof token !== 'string' || token.trim().length === 0) {
    return null;
  }
  
  // Security check: Warn if token appears to be a secret token (starts with sk.)
  // Public tokens typically start with pk. or are longer strings
  if (token.trim().startsWith('sk.')) {
    if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
      console.warn(
        '⚠️ SECURITY WARNING: Mapbox token appears to be a SECRET token (starts with "sk."). ' +
        'Secret tokens should NEVER be used in client-side code. Use a PUBLIC token (starts with "pk.") instead. ' +
        'See: https://docs.mapbox.com/help/glossary/access-token/'
      );
    }
  }
  
  return token.trim();
}

