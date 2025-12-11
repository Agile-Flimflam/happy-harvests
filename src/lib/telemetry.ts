import posthog, { type PostHog } from 'posthog-js';

type FlowId = 'planting-wizard' | 'quick-actions' | 'inline-sheet' | 'undo-retry';
type FlowOutcome = 'success' | 'error' | 'validation';
type DropReason = 'unmount' | 'navigate' | 'cancel' | 'timeout';

type TelemetryEvent =
  | { name: 'flow_step_view'; properties: FlowStepView }
  | { name: 'flow_step_submit'; properties: FlowStepSubmit }
  | { name: 'flow_step_result'; properties: FlowStepResult }
  | { name: 'flow_drop'; properties: FlowDrop }
  | { name: 'inline_sheet_open'; properties: InlineSheetEvent }
  | { name: 'inline_sheet_submit'; properties: InlineSheetSubmit }
  | { name: 'inline_sheet_result'; properties: InlineSheetResult }
  | { name: 'quick_action_trigger'; properties: QuickActionTrigger }
  | { name: 'quick_action_blocked'; properties: QuickActionBlocked }
  | { name: 'undo_action'; properties: UndoTelemetry }
  | { name: 'retry_action'; properties: RetryTelemetry };

type FlowStepView = {
  flowId: FlowId;
  stepId: string;
  elapsedMs: number;
  correlationId?: string;
  variant?: string;
};

type FlowStepSubmit = {
  flowId: FlowId;
  stepId: string;
  elapsedMs: number;
  correlationId?: string;
  variant?: string;
};

type FlowStepResult = {
  flowId: FlowId;
  stepId: string;
  outcome: FlowOutcome;
  errorCode?: string;
  elapsedMs: number;
  correlationId?: string;
  variant?: string;
};

type FlowDrop = {
  flowId: FlowId;
  stepId?: string;
  reason: DropReason;
  elapsedMs: number;
  correlationId?: string;
  variant?: string;
};

type InlineSheetEvent = {
  sheetId: string;
  flowId: FlowId;
  correlationId?: string;
  durationMs?: number;
};

type InlineSheetSubmit = InlineSheetEvent & { attempt: number };

type InlineSheetResult = InlineSheetEvent & {
  outcome: FlowOutcome;
  errorCode?: string;
  durationMs?: number;
};

type QuickActionTrigger = {
  actionId: string;
  allowed: boolean;
  blockedReason?: string;
  correlationId?: string;
  elapsedMs?: number;
};

type QuickActionBlocked = {
  actionId: string;
  missingDependency: string;
  correlationId?: string;
};

type UndoTelemetry = {
  target: string;
  correlationId?: string;
  outcome?: 'attempt' | 'success' | 'error';
  durationMs?: number;
  errorCode?: string;
};

type RetryTelemetry = {
  target: string;
  correlationId?: string;
  outcome?: 'attempt' | 'success' | 'error';
  durationMs?: number;
  errorCode?: string;
};

type TelemetryObserver = (event: TimestampedEvent) => void;

const observers: TelemetryObserver[] = [];
let client: PostHog | null = null;
let initialized = false;

type Timestamped<T> = T & { timestamp: number };

type TimestampedEvent<E extends TelemetryEvent = TelemetryEvent> = E extends {
  name: infer N;
  properties: infer P;
}
  ? { name: N; properties: Timestamped<P> }
  : never;

const now = (): number => {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }
  return Date.now();
};

const withTimestamp = <T>(props: T): Timestamped<T> => ({
  ...props,
  timestamp: Date.now(),
});

const getPostHog = (): PostHog | null => {
  if (typeof window === 'undefined') return null;
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return null;
  if (client) return client;
  if (initialized) return null;
  initialized = true;
  try {
    posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://app.posthog.com',
      capture_pageview: false,
      capture_pageleave: false,
      persistence: 'memory',
      autocapture: false,
      disable_session_recording: true,
    });
    client = posthog;
  } catch (error) {
    console.warn('[telemetry] Failed to init PostHog', error);
    client = null;
  }
  return client;
};

export function trackTelemetry<E extends TelemetryEvent>(event: E): void {
  const enriched = {
    ...event,
    properties: withTimestamp(event.properties),
  } as unknown as TimestampedEvent<E>;
  observers.forEach((observer) => observer(enriched));
  const ph = getPostHog();
  if (ph) {
    ph.capture(enriched.name, enriched.properties);
    return;
  }
  if (process.env.NODE_ENV !== 'production') {
    console.debug('[telemetry][noop]', enriched.name, enriched.properties);
  }
}

export function subscribeTelemetry(observer: TelemetryObserver): () => void {
  observers.push(observer);
  return () => {
    const idx = observers.indexOf(observer);
    if (idx >= 0) observers.splice(idx, 1);
  };
}

type FlowTrackerOptions = {
  flowId: FlowId;
  correlationId?: string;
  variant?: string;
};

export type FlowTracker = {
  markStepView: (stepId: string) => void;
  markSubmit: (stepId: string) => void;
  markResult: (stepId: string, outcome: FlowOutcome, errorCode?: string) => void;
  markDrop: (reason: DropReason, stepId?: string) => void;
  getElapsedMs: () => number;
};

export function createFlowTracker(options: FlowTrackerOptions): FlowTracker {
  const startedAt = now();
  let currentStep = '';

  const elapsed = (): number => now() - startedAt;

  const shared = {
    flowId: options.flowId,
    correlationId: options.correlationId,
    variant: options.variant,
  };

  const markStepView = (stepId: string) => {
    currentStep = stepId;
    trackTelemetry({
      name: 'flow_step_view',
      properties: { ...shared, stepId, elapsedMs: elapsed() },
    });
  };

  const markSubmit = (stepId: string) => {
    trackTelemetry({
      name: 'flow_step_submit',
      properties: { ...shared, stepId, elapsedMs: elapsed() },
    });
  };

  const markResult = (stepId: string, outcome: FlowOutcome, errorCode?: string) => {
    trackTelemetry({
      name: 'flow_step_result',
      properties: { ...shared, stepId, outcome, errorCode, elapsedMs: elapsed() },
    });
  };

  const markDrop = (reason: DropReason, stepId?: string) => {
    trackTelemetry({
      name: 'flow_drop',
      properties: { ...shared, stepId: stepId ?? currentStep, reason, elapsedMs: elapsed() },
    });
  };

  return {
    markStepView,
    markSubmit,
    markResult,
    markDrop,
    getElapsedMs: elapsed,
  };
}

export type InlineSheetTracker = {
  opened: () => void;
  submitted: () => void;
  succeeded: () => void;
  failed: (errorCode?: string) => void;
};

export function createInlineSheetTracker(
  sheetId: string,
  flowId: FlowId,
  correlationId?: string
): InlineSheetTracker {
  let attempt = 0;
  const openedAt = (): number => now();
  let startAt = openedAt();

  const shared = { sheetId, flowId, correlationId };

  const opened = () => {
    startAt = openedAt();
    trackTelemetry({ name: 'inline_sheet_open', properties: shared });
  };

  const submitted = () => {
    attempt += 1;
    trackTelemetry({
      name: 'inline_sheet_submit',
      properties: { ...shared, attempt },
    });
  };

  const succeeded = () => {
    trackTelemetry({
      name: 'inline_sheet_result',
      properties: { ...shared, outcome: 'success', durationMs: now() - startAt },
    });
  };

  const failed = (errorCode?: string) => {
    trackTelemetry({
      name: 'inline_sheet_result',
      properties: {
        ...shared,
        outcome: errorCode === 'validation' ? 'validation' : 'error',
        errorCode,
        durationMs: now() - startAt,
      },
    });
  };

  return { opened, submitted, succeeded, failed };
}

export function trackQuickActionTrigger(payload: QuickActionTrigger): void {
  trackTelemetry({ name: 'quick_action_trigger', properties: payload });
}

export function trackQuickActionBlocked(payload: QuickActionBlocked): void {
  trackTelemetry({ name: 'quick_action_blocked', properties: payload });
}

export function trackUndo(payload: UndoTelemetry): void;
export function trackUndo(target: string, correlationId?: string): void;
export function trackUndo(targetOrPayload: string | UndoTelemetry, correlationId?: string): void {
  const properties: UndoTelemetry =
    typeof targetOrPayload === 'string'
      ? { target: targetOrPayload, correlationId, outcome: 'attempt' }
      : { outcome: 'attempt', ...targetOrPayload };
  trackTelemetry({ name: 'undo_action', properties });
}

export function trackRetry(payload: RetryTelemetry): void;
export function trackRetry(target: string, correlationId?: string): void;
export function trackRetry(targetOrPayload: string | RetryTelemetry, correlationId?: string): void {
  const properties: RetryTelemetry =
    typeof targetOrPayload === 'string'
      ? { target: targetOrPayload, correlationId, outcome: 'attempt' }
      : { outcome: 'attempt', ...targetOrPayload };
  trackTelemetry({ name: 'retry_action', properties });
}

export function createStopwatch(): () => number {
  const start = now();
  return () => now() - start;
}
