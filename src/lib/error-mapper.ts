import type { PostgrestError } from '@supabase/supabase-js';
import { asActionError, type ActionError, type ActionErrorCode } from './action-result';

type DbError = Pick<PostgrestError, 'code' | 'message' | 'details'>;

const POSTGRES_DUPLICATE = '23505';
const POSTGRES_FOREIGN_KEY = '23503';

const codeLookup: Record<string, ActionErrorCode> = {
  [POSTGRES_DUPLICATE]: 'duplicate',
  [POSTGRES_FOREIGN_KEY]: 'dependency',
  PGRST116: 'not_found',
};

export function mapDbError(
  error: DbError,
  correlationId?: string,
  fallbackMessage = 'Database error'
): ActionError {
  const code = error.code ? (codeLookup[error.code] ?? 'server') : 'server';
  const message = error.message || fallbackMessage;
  const details = typeof error.details === 'string' ? error.details : undefined;
  return asActionError({
    code,
    message,
    details,
    correlationId,
  });
}

export function mapUnexpectedError(
  error: unknown,
  correlationId?: string,
  fallbackMessage = 'Unexpected error'
): ActionError {
  const message =
    error instanceof Error ? error.message : typeof error === 'string' ? error : fallbackMessage;
  return asActionError({
    code: 'unknown',
    message,
    correlationId,
  });
}
