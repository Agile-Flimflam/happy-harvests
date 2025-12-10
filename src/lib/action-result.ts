export type ActionErrorCode =
  | 'validation'
  | 'conflict'
  | 'dependency'
  | 'forbidden'
  | 'not_found'
  | 'server';

export type ActionError = {
  code: ActionErrorCode;
  message: string;
  fieldErrors?: Record<string, string | string[]>;
};

export type ActionResult<T> = { ok: true; data: T } | ({ ok: false } & ActionError);

export function asActionError<T>(error: ActionError): ActionResult<T> {
  return { ok: false, ...error };
}
