import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockApi, mockNotificationSound } = vi.hoisted(() => ({
  mockApi: {
    getUnreadCount: vi.fn(),
  },
  mockNotificationSound: {
    playNotificationSound: vi.fn(),
    playNotificationVariant: vi.fn(),
    requestNotificationPermission: vi.fn(),
    showBrowserNotification: vi.fn(),
  },
}));

vi.mock('../utils/api', () => ({ default: mockApi }));
vi.mock('../utils/notificationSound', () => mockNotificationSound);

import { useMessagingPolling } from '../hooks/useMessagingPolling';
import { useMessagingSSE } from '../hooks/useMessagingSSE';

class MockEventSource {
  static instances = [];

  constructor(url) {
    this.url = url;
    this.listeners = new Map();
    this.onopen = null;
    this.onerror = null;
    this.closed = false;
    MockEventSource.instances.push(this);
  }

  addEventListener(name, callback) {
    this.listeners.set(name, callback);
  }

  emit(name, payload) {
    const callback = this.listeners.get(name);
    if (callback) callback({ data: JSON.stringify(payload) });
  }

  close() {
    this.closed = true;
  }
}

describe('messaging SSE hooks', () => {
  const originalEventSource = globalThis.EventSource;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    MockEventSource.instances = [];
    globalThis.EventSource = MockEventSource;
    mockApi.getUnreadCount.mockResolvedValue({ unread: 0 });
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    globalThis.EventSource = originalEventSource;
  });

  it('useMessagingSSE clears reconnect timeout on unmount', () => {
    const { unmount } = renderHook(() =>
      useMessagingSSE({ currentUser: { id: 1 }, onNewMessage: vi.fn(), isMessagingOpen: false }),
    );

    expect(MockEventSource.instances).toHaveLength(1);

    act(() => {
      MockEventSource.instances[0].onerror();
    });

    unmount();

    act(() => {
      vi.advanceTimersByTime(35000);
    });

    expect(MockEventSource.instances).toHaveLength(1);
  });

  it('useMessagingPolling clears reconnect timeout on unmount', () => {
    const userPrefsRef = {
      current: {
        soundEnabled: false,
        notificationsEnabled: false,
        notificationSoundVariant: 'default',
      },
    };
    const showMessagingRef = { current: false };
    const toast = { info: vi.fn() };

    const { unmount } = renderHook(() =>
      useMessagingPolling({ currentUser: { id: 1 }, userPrefsRef, showMessagingRef, toast }),
    );

    expect(MockEventSource.instances).toHaveLength(1);

    act(() => {
      MockEventSource.instances[0].onerror();
    });

    unmount();

    act(() => {
      vi.advanceTimersByTime(7000);
    });

    expect(MockEventSource.instances).toHaveLength(1);
  });
});
