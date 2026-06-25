import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockApi } = vi.hoisted(() => ({
  mockApi: {
    getGoogleEventsV2: vi.fn(),
  },
}));

vi.mock('../utils/api', () => ({ default: mockApi }));

import { useGoogleSync } from '../hooks/useGoogleSync';

class MockBroadcastChannel {
  static instances = [];

  constructor(name) {
    this.name = name;
    this.closed = false;
    this.onmessage = null;
    MockBroadcastChannel.instances.push(this);
  }

  postMessage() {
    // no-op
  }

  close() {
    this.closed = true;
  }
}

describe('useGoogleSync', () => {
  const originalBroadcastChannel = globalThis.BroadcastChannel;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    MockBroadcastChannel.instances = [];
    globalThis.BroadcastChannel = MockBroadcastChannel;
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    globalThis.BroadcastChannel = originalBroadcastChannel;
  });

  it('closes channel and clears scheduled timers on unmount', () => {
    const clearIntervalSpy = vi.spyOn(globalThis, 'clearInterval');

    const { unmount } = renderHook(() =>
      useGoogleSync({
        isSignedIn: false,
        view: '',
        currentDate: new Date('2026-06-25T12:00:00.000Z'),
        calendarId: 'primary',
      }),
    );

    expect(MockBroadcastChannel.instances).toHaveLength(1);

    act(() => {
      MockBroadcastChannel.instances[0].onmessage?.({
        data: { type: 'leader-heartbeat', tabId: 'other-tab' },
      });
    });

    unmount();

    expect(MockBroadcastChannel.instances[0].closed).toBe(true);
    expect(clearIntervalSpy).toHaveBeenCalled();

    clearIntervalSpy.mockRestore();
  });
});
