'use client';

import { useEffect } from 'react';
import { setupGlobalFormControlListener } from '@/lib/form-utils';

/**
 * Client component that sets up global form control property listener.
 * This ensures form.control is set up for all forms before browser extensions
 * try to access it during focus events.
 * 
 * Should be mounted once at the app root level.
 */
export function FormControlSetup() {
  useEffect(() => {
    setupGlobalFormControlListener();
  }, []);

  return null;
}

