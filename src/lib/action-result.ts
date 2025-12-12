import type { ZodError } from 'zod';

export type ActionErrorCode =
  | 'validation'
  | 'duplicate'
  | 'conflict'
  | 'capacity_exceeded'
  | 'overlap'
  | 'invalid_date'
  | 'invalid_range'
  | 'dependency'
  | 'forbidden'
  | 'unauthorized'
  | 'not_found'
  | 'network'
  | 'server'
  | 'unknown';

export type ActionError = {
  ok: false;
  code: ActionErrorCode;
  message: string;
  fieldErrors?: Record<string, string[]>;
  details?: string;
  correlationId: string;
  retryable?: boolean;
};

export type ActionSuccess<T> = {
  ok: true;
  data: T;
  message?: string;
  correlationId: string;
};

export type ActionResult<T> = ActionSuccess<T> | ActionError;

export function createCorrelationId(seed?: string): string {
  if (seed && seed.trim().length > 0) return seed;
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback for environments without crypto.randomUUID
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function asActionError(
  error: Omit<ActionError, 'ok' | 'correlationId'> & { correlationId?: string }
): ActionError {
  return { ok: false, correlationId: createCorrelationId(error.correlationId), ...error };
}

export function asActionSuccess<T>(
  data: T,
  message?: string,
  correlationId?: string
): ActionResult<T> {
  return {
    ok: true,
    data,
    message,
    correlationId: createCorrelationId(correlationId),
  };
}

export function mapZodFieldErrors(error: ZodError): Record<string, string[]> {
  const flattened = error.flatten().fieldErrors;
  const result: Record<string, string[]> = {};
  Object.entries(flattened).forEach(([field, messages]) => {
    if (!Array.isArray(messages) || messages.length === 0) return;
    const filtered = messages.filter(
      (msg): msg is string => typeof msg === 'string' && msg.length > 0
    );
    if (filtered.length === 0) return;
    result[field] = filtered;
  });
  return result;
}

export function logActionError(
  context: string,
  error: ActionError,
  meta?: Record<string, unknown>
): void {
  const shouldLog =
    process.env.NODE_ENV !== 'production' || process.env.NEXT_PUBLIC_LOG_ACTION_ERRORS === 'true';
  if (!shouldLog) return;
  // Intentionally avoid logging potentially sensitive payloads; only include safe context.
  console.error('[action-error]', {
    context,
    code: error.code,
    message: error.message,
    correlationId: error.correlationId,
    retryable: error.retryable ?? false,
    meta,
  });
}
