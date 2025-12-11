import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import RemovePlantingForm from '../RemovePlantingForm';
import { subscribeTelemetry } from '@/lib/telemetry';
import type { PlantingFormState } from '../../_actions';

const mockUndoRemove = jest.fn().mockResolvedValue({
  ok: true,
  message: 'Undo successful',
  correlationId: 'undo-1',
  data: { undoId: 123 },
});

jest.mock('../../_actions', () => ({
  actionRemove: jest.fn(),
  undoRemovePlanting: (...args: unknown[]) => mockUndoRemove(...args),
}));

let mockHookState: PlantingFormState = {
  ok: true,
  data: { planting: null, undoId: 123 },
  message: 'Removed',
  correlationId: 'corr-success',
};
const mockRetry = jest.fn();

jest.mock('@/hooks/use-retryable-action', () => ({
  useRetryableActionState: () => ({
    state: mockHookState,
    dispatch: jest.fn(),
    retry: mockRetry,
    hasPayload: true,
  }),
}));

const toastSuccess = jest.fn();
const toastError = jest.fn();

jest.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccess(...args),
    error: (...args: unknown[]) => toastError(...args),
  },
}));

describe('RemovePlantingForm telemetry', () => {
  beforeEach(() => {
    mockUndoRemove.mockClear();
    mockRetry.mockClear();
    toastSuccess.mockClear();
    toastError.mockClear();
    mockHookState = {
      ok: true,
      data: { planting: null, undoId: 123 },
      message: 'Removed',
      correlationId: 'corr-success',
    };
  });

  it('emits undo telemetry on undo success', async () => {
    const events: Array<{ name: string; properties: Record<string, unknown> }> = [];
    const unsubscribe = subscribeTelemetry((event) => events.push(event));
    render(<RemovePlantingForm plantingId={1} closeDialog={jest.fn()} formId="remove" />);

    const action = toastSuccess.mock.calls[0]?.[1]?.action;
    expect(action?.onClick).toBeDefined();
    action.onClick();

    await waitFor(() => expect(mockUndoRemove).toHaveBeenCalled());
    unsubscribe();

    const undoEvents = events.filter((e) => e.name === 'undo_action');
    expect(undoEvents.length).toBeGreaterThanOrEqual(2);
    expect(undoEvents.some((e) => e.properties.outcome === 'attempt')).toBe(true);
    expect(undoEvents.some((e) => e.properties.outcome === 'success')).toBe(true);
  });

  it('records retry attempt telemetry from retry control', () => {
    mockHookState = {
      ok: false,
      message: 'Failed',
      correlationId: 'corr-fail',
      code: 'server',
    };
    const events: Array<{ name: string; properties: Record<string, unknown> }> = [];
    const unsubscribe = subscribeTelemetry((event) => events.push(event));

    render(<RemovePlantingForm plantingId={1} closeDialog={jest.fn()} formId="remove" />);

    const retryButton = screen.getByRole('button', { name: /retry/i });
    fireEvent.click(retryButton);

    unsubscribe();
    const retryEvent = events.find((e) => e.name === 'retry_action');
    expect(retryEvent?.properties.outcome).toBe('attempt');
  });
});
