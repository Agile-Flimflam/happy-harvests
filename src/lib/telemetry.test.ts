import { createFlowTracker, subscribeTelemetry } from './telemetry';

describe('telemetry helpers', () => {
  it('emits flow tracker events with elapsed timing', () => {
    const events: Array<{ name: string; properties: Record<string, unknown> }> = [];
    const unsubscribe = subscribeTelemetry((event) => events.push(event));
    const tracker = createFlowTracker({ flowId: 'planting-wizard', correlationId: 'flow-1' });

    tracker.markStepView('location');
    tracker.markSubmit('location');
    tracker.markResult('location', 'success');
    tracker.markDrop('cancel', 'location');

    unsubscribe();
    const names = events.map((e) => e.name);
    expect(names).toEqual(['flow_step_view', 'flow_step_submit', 'flow_step_result', 'flow_drop']);
    events.forEach((event) => {
      expect(typeof event.properties.elapsedMs).toBe('number');
      expect(event.properties.correlationId).toBe('flow-1');
    });
  });
});
