import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('ReactFlow Canvas Resize & Layout Shift Listeners', () => {
  let listeners: Record<string, EventListenerOrEventListenerObject[]> = {};

  beforeEach(() => {
    listeners = {};
    if (typeof global.window === 'undefined') {
      // @ts-ignore
      global.window = {
        addEventListener: (event: string, cb: EventListenerOrEventListenerObject) => {
          if (!listeners[event]) listeners[event] = [];
          listeners[event].push(cb);
        },
        removeEventListener: (event: string, cb: EventListenerOrEventListenerObject) => {
          if (listeners[event]) {
            listeners[event] = listeners[event].filter((fn) => fn !== cb);
          }
        },
        dispatchEvent: (event: { type: string }) => {
          const evListeners = listeners[event.type] || [];
          evListeners.forEach((fn) => {
            if (typeof fn === 'function') fn(event as unknown as Event);
          });
          return true;
        },
      };
      // @ts-ignore
      global.CustomEvent = class CustomEvent {
        type: string;
        constructor(type: string) {
          this.type = type;
        }
      };
      // @ts-ignore
      global.Event = class Event {
        type: string;
        constructor(type: string) {
          this.type = type;
        }
      };
    }
  });

  it('dispatches custom workspace layout shift event on sidebar expansion', () => {
    const listener = vi.fn();
    window.addEventListener('retrace:workspaceLayoutShift', listener);

    window.dispatchEvent(new CustomEvent('retrace:workspaceLayoutShift'));

    expect(listener).toHaveBeenCalledTimes(1);

    window.removeEventListener('retrace:workspaceLayoutShift', listener);
  });

  it('triggers window resize event during layout shifts so ReactFlow bounds update dynamically', () => {
    const resizeListener = vi.fn();
    window.addEventListener('resize', resizeListener);

    window.dispatchEvent(new Event('resize'));

    expect(resizeListener).toHaveBeenCalledTimes(1);

    window.removeEventListener('resize', resizeListener);
  });

  describe('ReactFlow Scale vs. Sidebar State (Use Case 4)', () => {
    it('handles sudden workspace layout shifts smoothly when expanding tree loops ("Show more child iterations") so node connectors do not offset or clip', () => {
      const shiftListener = vi.fn();
      const resizeListener = vi.fn();

      window.addEventListener('retrace:workspaceLayoutShift', shiftListener);
      window.addEventListener('resize', resizeListener);

      // Scenario: User expands a massive tree loop in the left sidebar (clicking "Show more child iterations")
      window.dispatchEvent(new CustomEvent('retrace:workspaceLayoutShift'));

      // The layout shift should trigger a window resize event to update ReactFlow canvas bounds
      window.dispatchEvent(new Event('resize'));

      expect(shiftListener).toHaveBeenCalledTimes(1);
      expect(resizeListener).toHaveBeenCalledTimes(1);

      window.removeEventListener('retrace:workspaceLayoutShift', shiftListener);
      window.removeEventListener('resize', resizeListener);
    });
  });
});
