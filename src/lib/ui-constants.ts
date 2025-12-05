/**
 * Centralized UI constants for consistent styling across the application.
 * 
 * These constants define z-index values for different UI layers to prevent
 * conflicts and ensure proper layering of components.
 * 
 * Z-index hierarchy (from lowest to highest):
 * - base: 0 (default)
 * - dropdown: 50 (dialogs, popovers, tooltips, select dropdowns)
 * - autocomplete: 100 (autocomplete dropdowns that must appear above dialogs)
 * 
 * Note: These values are intentionally spaced to allow for future intermediate layers.
 */

/**
 * Z-index values for UI layers.
 * 
 * These values ensure proper stacking order:
 * - Dialogs and overlays use z-50 (50)
 * - Autocomplete dropdowns use z-100 (100) to appear above dialogs
 */
export const Z_INDEX = {
  /** Base layer (default) */
  base: 0,
  /** Dialog, popover, tooltip, and select dropdown layer */
  dropdown: 50,
  /** Autocomplete dropdown layer (must be above dialogs) */
  autocomplete: 100,
} as const;

/**
 * Type for z-index values.
 */
export type ZIndexValue = (typeof Z_INDEX)[keyof typeof Z_INDEX];

