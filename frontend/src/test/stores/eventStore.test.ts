import { describe, it, expect, beforeEach } from 'vitest';
import { useEventStore } from '../../stores';

describe('useEventStore', () => {
  beforeEach(() => {
    useEventStore.setState({
      events: [],
      sseConnected: false,
    });
  });

  describe('initial state', () => {
    it('should start with no events and disconnected', () => {
      const state = useEventStore.getState();
      expect(state.events).toEqual([]);
      expect(state.sseConnected).toBe(false);
    });
  });

  describe('addEvent', () => {
    it('should prepend new events', () => {
      const event1 = { id: '1', project_id: 'p1', iteration_id: null, event_type: 'spec.created', payload: {}, actor_id: null, source: 'api', created_at: '2024-01-01T00:00:00Z' };
      const event2 = { id: '2', project_id: 'p1', iteration_id: null, event_type: 'adr.created', payload: {}, actor_id: null, source: 'api', created_at: '2024-01-01T00:01:00Z' };

      useEventStore.getState().addEvent(event1);
      useEventStore.getState().addEvent(event2);

      const events = useEventStore.getState().events;
      expect(events[0]).toEqual(event2);
      expect(events[1]).toEqual(event1);
    });

    it('should cap at 100 events', () => {
      for (let i = 0; i < 110; i++) {
        useEventStore.getState().addEvent({
          id: `${i}`,
          project_id: 'p1',
          iteration_id: null,
          event_type: 'test',
          payload: {},
          actor_id: null,
          source: 'api',
          created_at: '2024-01-01T00:00:00Z',
        });
      }
      const events = useEventStore.getState().events;
      expect(events.length).toBe(100);
      expect(events[0].id).toBe('109');
    });
  });

  describe('setEvents', () => {
    it('should replace all events', () => {
      const events = [
        { id: '1', project_id: 'p1', iteration_id: null, event_type: 'spec.created', payload: {}, actor_id: null, source: 'api', created_at: '2024-01-01T00:00:00Z' },
        { id: '2', project_id: 'p1', iteration_id: null, event_type: 'adr.created', payload: {}, actor_id: null, source: 'api', created_at: '2024-01-01T00:01:00Z' },
      ];
      useEventStore.getState().setEvents(events);
      expect(useEventStore.getState().events).toEqual(events);
    });
  });

  describe('setSseConnected', () => {
    it('should toggle SSE connection status', () => {
      useEventStore.getState().setSseConnected(true);
      expect(useEventStore.getState().sseConnected).toBe(true);

      useEventStore.getState().setSseConnected(false);
      expect(useEventStore.getState().sseConnected).toBe(false);
    });
  });
});
