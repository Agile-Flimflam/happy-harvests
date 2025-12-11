'use client';

import { useActionState, useCallback, useRef } from 'react';

export function useRetryableActionState<TState, TPayload>(
  action: (prevState: TState, payload: TPayload) => Promise<TState>,
  initialState: TState
): {
  state: TState;
  dispatch: (payload: TPayload) => void;
  retry: () => void;
  hasPayload: boolean;
} {
  const lastPayloadRef = useRef<TPayload | null>(null);
  const reducer = async (prevState: TState, payload: TPayload): Promise<TState> => {
    lastPayloadRef.current = payload;
    return action(prevState, payload);
  };
  const [state, dispatchBase] = useActionState(
    reducer as (state: Awaited<TState>, payload: TPayload) => TState | Promise<TState>,
    initialState as Awaited<TState>
  );

  const dispatch = useCallback(
    (payload: TPayload) => {
      dispatchBase(payload as unknown as never);
    },
    [dispatchBase]
  );

  const retry = useCallback(() => {
    if (lastPayloadRef.current == null) return;
    dispatch(lastPayloadRef.current);
  }, [dispatch]);

  return {
    state,
    dispatch,
    retry,
    hasPayload: lastPayloadRef.current != null,
  };
}
