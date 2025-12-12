import { act, fireEvent, render, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { QuickActionsHub } from '../quick-actions-hub';
import type { QuickActionContext } from '@/app/(app)/actions';
import { subscribeTelemetry } from '@/lib/telemetry';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock('@/app/(app)/plots/_components/PlotForm', () => ({
  PlotForm: ({
    onSubmitTelemetry,
    onResultTelemetry,
    onCreated,
  }: {
    onSubmitTelemetry?: () => void;
    onResultTelemetry?: (outcome: 'success' | 'error', code?: string) => void;
    onCreated?: () => void;
  }): ReactElement => (
    <div>
      <button
        type="button"
        onClick={() => {
          onSubmitTelemetry?.();
          onResultTelemetry?.('success');
          onCreated?.();
        }}
      >
        complete-plot
      </button>
      <button
        type="button"
        onClick={() => {
          onSubmitTelemetry?.();
          onResultTelemetry?.('error', 'validation');
        }}
      >
        fail-plot
      </button>
    </div>
  ),
}));

jest.mock('@/app/(app)/plots/_components/BedForm', () => ({
  BedForm: ({
    onSubmitTelemetry,
    onResultTelemetry,
    onCreated,
  }: {
    onSubmitTelemetry?: () => void;
    onResultTelemetry?: (outcome: 'success' | 'error', code?: string) => void;
    onCreated?: () => void;
  }): ReactElement => (
    <div>
      <button
        type="button"
        onClick={() => {
          onSubmitTelemetry?.();
          onResultTelemetry?.('success');
          onCreated?.();
        }}
      >
        complete-bed
      </button>
      <button
        type="button"
        onClick={() => {
          onSubmitTelemetry?.();
          onResultTelemetry?.('error', 'validation');
        }}
      >
        fail-bed
      </button>
    </div>
  ),
}));

jest.mock('@/app/(app)/crop-varieties/_components/CropVarietyForm', () => ({
  CropVarietyForm: ({
    onSubmitTelemetry,
    onResultTelemetry,
    onCreated,
  }: {
    onSubmitTelemetry?: () => void;
    onResultTelemetry?: (outcome: 'success' | 'error', code?: string) => void;
    onCreated?: () => void;
  }): ReactElement => (
    <div>
      <button
        type="button"
        onClick={() => {
          onSubmitTelemetry?.();
          onResultTelemetry?.('success');
          onCreated?.();
        }}
      >
        complete-crop
      </button>
      <button
        type="button"
        onClick={() => {
          onSubmitTelemetry?.();
          onResultTelemetry?.('error', 'validation');
        }}
      >
        fail-crop
      </button>
    </div>
  ),
}));

jest.mock('@/app/(app)/plantings/_components/NurserySowForm', () => ({
  NurserySowForm: ({
    onSubmitTelemetry,
    onResultTelemetry,
    onRetryTelemetry,
  }: {
    onSubmitTelemetry?: () => void;
    onResultTelemetry?: (outcome: 'success' | 'error', code?: string) => void;
    onRetryTelemetry?: () => void;
  }): ReactElement => (
    <div>
      <button
        type="button"
        onClick={() => {
          onSubmitTelemetry?.();
          onResultTelemetry?.('success');
        }}
      >
        complete-sow
      </button>
      <button
        type="button"
        onClick={() => {
          onSubmitTelemetry?.();
          onRetryTelemetry?.();
          onResultTelemetry?.('error', 'validation');
        }}
      >
        fail-sow
      </button>
    </div>
  ),
}));

const baseContext: QuickActionContext = {
  cropVarieties: [],
  crops: [],
  plots: [],
  locations: [],
  nurseries: [],
  beds: [],
  counts: {
    cropVarieties: 0,
    plots: 0,
    beds: 0,
    nurseries: 0,
  },
};

describe('QuickActionsHub telemetry', () => {
  it('emits blocked quick action and inline sheet open when dependencies missing', () => {
    const events: Array<{ name: string; properties: Record<string, unknown> }> = [];
    const unsubscribe = subscribeTelemetry((event) => events.push(event));
    render(<QuickActionsHub context={baseContext} />);

    fireEvent.click(screen.getByRole('button', { name: /start planting/i }));

    unsubscribe();
    expect(
      events.some((e) => e.name === 'quick_action_trigger' && e.properties.allowed === false)
    ).toBe(true);
    expect(
      events.some(
        (e) =>
          e.name === 'quick_action_blocked' && e.properties.missingDependency === 'crop-variety'
      )
    ).toBe(true);
    expect(
      events.some(
        (e) => e.name === 'inline_sheet_open' && e.properties.sheetId === 'quick-crop-variety'
      )
    ).toBe(true);
  });

  it('emits success telemetry for inline crop variety sheet', () => {
    const events: Array<{ name: string; properties: Record<string, unknown> }> = [];
    const unsubscribe = subscribeTelemetry((event) => events.push(event));
    render(
      <QuickActionsHub
        context={{
          ...baseContext,
          counts: { cropVarieties: 1, plots: 0, beds: 0, nurseries: 0 },
        }}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /add crop variety/i }));
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: /complete-crop/i }));
    });

    unsubscribe();
    const submitEvent = events.find((e) => e.name === 'inline_sheet_submit');
    const resultEvent = events.find((e) => e.name === 'inline_sheet_result');
    expect(submitEvent?.properties.sheetId).toBe('quick-crop-variety');
    expect(resultEvent?.properties.outcome).toBe('success');
  });
});
