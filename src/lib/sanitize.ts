const htmlEscapeMap: Readonly<Record<string, string>> = Object.freeze({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
});

const htmlEscapeRegex = /[&<>"']/g;

/**
 * Escape a string for safe HTML text rendering.
 * Centralized to avoid duplicating ad-hoc entity replacements.
 */
export function escapeHtml(value: string): string {
  return value.replace(htmlEscapeRegex, (ch) => htmlEscapeMap[ch] ?? ch);
}

/**
 * Convert a potentially unsafe error message into safe HTML text.
 * Falls back to a generic message when none is provided.
 */
export function sanitizeErrorMessage(message?: string): string {
  if (!message) return 'An unexpected error occurred';
  return escapeHtml(message);
}
