'use client';

import * as React from 'react';
import { Check, Circle, Dot, X } from 'lucide-react';

import { cn } from '@/lib/utils';

export type StepStatus = 'complete' | 'current' | 'upcoming' | 'error';

export type StepDefinition = {
  id: string;
  title: string;
  description?: string;
  status?: StepStatus;
  disabled?: boolean;
  optional?: boolean;
  icon?: React.ReactNode;
};

export type StepperProps = {
  steps: StepDefinition[];
  currentStepId: string;
  onStepChange?: (stepId: string) => void;
  orientation?: 'horizontal' | 'vertical';
  className?: string;
  autoFocusCurrent?: boolean;
  ariaLabel?: string;
};

function getStatus(step: StepDefinition, currentStepId: string, hasError: boolean): StepStatus {
  if (step.status) return step.status;
  if (hasError) return 'error';
  if (step.id === currentStepId) return 'current';
  return 'upcoming';
}

const statusIconMap: Record<StepStatus, React.ReactNode> = {
  complete: <Check className="h-4 w-4" aria-hidden />,
  current: <Dot className="h-5 w-5" aria-hidden />,
  upcoming: <Circle className="h-4 w-4" aria-hidden />,
  error: <X className="h-4 w-4" aria-hidden />,
};

export function Stepper({
  steps,
  currentStepId,
  onStepChange,
  orientation = 'horizontal',
  className,
  autoFocusCurrent = false,
  ariaLabel = 'Progress steps',
}: StepperProps) {
  const itemRefs = React.useRef<Record<string, HTMLButtonElement | null>>({});

  React.useEffect(() => {
    if (!autoFocusCurrent) return;
    const button = itemRefs.current[currentStepId];
    if (button) {
      button.focus();
    }
  }, [currentStepId, autoFocusCurrent]);

  const showVertical = orientation === 'vertical';

  return (
    <ol
      role="list"
      aria-label={ariaLabel}
      className={cn(
        'flex w-full gap-3 sm:gap-4',
        showVertical ? 'flex-col' : 'flex-row items-start',
        className
      )}
    >
      {steps.map((step, index) => {
        const status = getStatus(
          step,
          currentStepId,
          step.status === 'error' || currentStepId === `${step.id}-error`
        );
        const isCurrent = status === 'current';
        const isComplete = status === 'complete';
        const isError = status === 'error';
        const isLast = index === steps.length - 1;

        return (
          <li
            key={step.id}
            className={cn(
              'relative flex min-w-0 flex-1 items-start gap-3 rounded-lg px-3 py-2',
              isCurrent ? 'bg-muted/50' : 'bg-transparent',
              step.disabled ? 'opacity-60' : '',
              showVertical ? 'border border-transparent' : ''
            )}
          >
            {!showVertical && !isLast ? (
              <div
                className="absolute left-[calc(50%+12px)] right-0 top-5 hidden h-px bg-border sm:block"
                aria-hidden
              />
            ) : null}
            <div className="relative flex h-10 w-10 shrink-0 items-center justify-center">
              <div
                className={cn(
                  'flex h-9 w-9 items-center justify-center rounded-full border transition',
                  isCurrent
                    ? 'border-primary bg-primary/10 text-primary'
                    : isComplete
                      ? 'border-primary/60 bg-primary/10 text-primary'
                      : isError
                        ? 'border-destructive/60 bg-destructive/10 text-destructive'
                        : 'border-muted-foreground/30 text-muted-foreground'
                )}
              >
                {step.icon ?? statusIconMap[status]}
              </div>
              {showVertical && !isLast ? (
                <div
                  className="absolute left-1/2 top-11 h-full w-px -translate-x-1/2 bg-border"
                  aria-hidden
                />
              ) : null}
            </div>

            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  ref={(node) => {
                    itemRefs.current[step.id] = node;
                  }}
                  type="button"
                  onClick={() => onStepChange?.(step.id)}
                  className={cn(
                    'text-left text-base font-medium leading-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                    isCurrent
                      ? 'text-foreground'
                      : isComplete
                        ? 'text-foreground'
                        : 'text-muted-foreground',
                    step.disabled ? 'pointer-events-none' : ''
                  )}
                  aria-current={isCurrent ? 'step' : undefined}
                  aria-disabled={step.disabled}
                >
                  {step.title}
                </button>
                {step.optional ? (
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                    Optional
                  </span>
                ) : null}
              </div>
              {step.description ? (
                <p className="text-sm text-muted-foreground">{step.description}</p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
