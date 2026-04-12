import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import {
  DEFAULT_BREAK_SECONDS,
  DEFAULT_FOCUS_SECONDS,
  POMODORO_STORAGE_KEY,
  usePomodoroTimer,
} from './usePomodoroTimer.js';

function createLocalStorageMock() {
  const store = new Map<string, string>();

  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
  } as Storage;
}

describe('usePomodoroTimer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-11T14:00:00.000Z'));
    vi.stubGlobal('localStorage', createLocalStorageMock());
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  test('uses focus defaults on first load', () => {
    const { result } = renderHook(() => usePomodoroTimer());

    expect(result.current.phase).toBe('focus');
    expect(result.current.status).toBe('idle');
    expect(result.current.remainingSeconds).toBe(DEFAULT_FOCUS_SECONDS);
    expect(result.current.endTimeMs).toBeNull();
    expect(result.current.completionCount).toBe(0);
  });

  test('starts the timer and persists a running state', () => {
    const nowMs = Date.now();
    const { result } = renderHook(() => usePomodoroTimer());

    act(() => {
      result.current.start();
    });

    expect(result.current.status).toBe('running');
    expect(result.current.remainingSeconds).toBe(DEFAULT_FOCUS_SECONDS);
    expect(result.current.endTimeMs).toBe(nowMs + (DEFAULT_FOCUS_SECONDS * 1000));

    expect(window.localStorage.getItem(POMODORO_STORAGE_KEY)).toBe(JSON.stringify({
      phase: 'focus',
      status: 'running',
      remainingSeconds: DEFAULT_FOCUS_SECONDS,
      endTimeMs: nowMs + (DEFAULT_FOCUS_SECONDS * 1000),
    }));
  });

  test('pauses and resumes without drifting from the end time', () => {
    const { result } = renderHook(() => usePomodoroTimer());

    act(() => {
      result.current.start();
    });

    act(() => {
      vi.advanceTimersByTime(70_000);
    });

    expect(result.current.remainingSeconds).toBe(DEFAULT_FOCUS_SECONDS - 70);

    act(() => {
      result.current.pause();
    });

    const pausedRemaining = result.current.remainingSeconds;

    expect(result.current.status).toBe('paused');
    expect(result.current.endTimeMs).toBeNull();
    expect(pausedRemaining).toBe(DEFAULT_FOCUS_SECONDS - 70);

    act(() => {
      vi.advanceTimersByTime(30_000);
    });

    expect(result.current.remainingSeconds).toBe(pausedRemaining);

    const resumeNowMs = Date.now();

    act(() => {
      result.current.start();
    });

    expect(result.current.status).toBe('running');
    expect(result.current.remainingSeconds).toBe(pausedRemaining);
    expect(result.current.endTimeMs).toBe(resumeNowMs + (pausedRemaining * 1000));

    act(() => {
      vi.advanceTimersByTime(30_000);
    });

    expect(result.current.remainingSeconds).toBe(pausedRemaining - 30);
  });

  test('resets the active phase back to its full duration', () => {
    const { result } = renderHook(() => usePomodoroTimer());

    act(() => {
      result.current.start();
    });

    act(() => {
      vi.advanceTimersByTime(45_000);
    });

    act(() => {
      result.current.reset();
    });

    expect(result.current.phase).toBe('focus');
    expect(result.current.status).toBe('idle');
    expect(result.current.remainingSeconds).toBe(DEFAULT_FOCUS_SECONDS);
    expect(result.current.endTimeMs).toBeNull();
  });

  test('switches phase and resets duration for the selected mode', () => {
    const { result } = renderHook(() => usePomodoroTimer());

    act(() => {
      result.current.switchPhase();
    });

    expect(result.current.phase).toBe('break');
    expect(result.current.status).toBe('idle');
    expect(result.current.remainingSeconds).toBe(DEFAULT_BREAK_SECONDS);
    expect(result.current.endTimeMs).toBeNull();

    act(() => {
      result.current.switchPhase('focus');
    });

    expect(result.current.phase).toBe('focus');
    expect(result.current.remainingSeconds).toBe(DEFAULT_FOCUS_SECONDS);
  });

  test('marks completion at zero and increments the completion signal', () => {
    const { result } = renderHook(() => usePomodoroTimer());

    act(() => {
      result.current.start();
    });

    act(() => {
      vi.advanceTimersByTime(DEFAULT_FOCUS_SECONDS * 1000);
    });

    expect(result.current.status).toBe('idle');
    expect(result.current.remainingSeconds).toBe(0);
    expect(result.current.endTimeMs).toBeNull();
    expect(result.current.completionCount).toBe(1);

    act(() => {
      result.current.start();
    });

    act(() => {
      vi.advanceTimersByTime(DEFAULT_FOCUS_SECONDS * 1000);
    });

    expect(result.current.completionCount).toBe(2);
  });

  test('hydrates a stored running timer from endTimeMs instead of stale remainingSeconds', () => {
    const nowMs = Date.now();
    window.localStorage.setItem(POMODORO_STORAGE_KEY, JSON.stringify({
      phase: 'break',
      status: 'running',
      remainingSeconds: DEFAULT_BREAK_SECONDS,
      endTimeMs: nowMs + 90_000,
    }));

    const { result } = renderHook(() => usePomodoroTimer());

    expect(result.current.phase).toBe('break');
    expect(result.current.status).toBe('running');
    expect(result.current.remainingSeconds).toBe(90);
    expect(result.current.endTimeMs).toBe(nowMs + 90_000);

    act(() => {
      vi.advanceTimersByTime(10_000);
    });

    expect(result.current.remainingSeconds).toBe(80);
  });

  test('hydrates an expired running timer as completed and rewrites storage', () => {
    const nowMs = Date.now();
    window.localStorage.setItem(POMODORO_STORAGE_KEY, JSON.stringify({
      phase: 'focus',
      status: 'running',
      remainingSeconds: DEFAULT_FOCUS_SECONDS,
      endTimeMs: nowMs - 5_000,
    }));

    const { result } = renderHook(() => usePomodoroTimer());

    expect(result.current.phase).toBe('focus');
    expect(result.current.status).toBe('idle');
    expect(result.current.remainingSeconds).toBe(0);
    expect(result.current.endTimeMs).toBeNull();
    expect(result.current.completionCount).toBe(1);
    expect(window.localStorage.getItem(POMODORO_STORAGE_KEY)).toBe(JSON.stringify({
      phase: 'focus',
      status: 'idle',
      remainingSeconds: 0,
      endTimeMs: null,
    }));
  });

  test('falls back to defaults when localStorage payload is malformed', () => {
    window.localStorage.setItem(POMODORO_STORAGE_KEY, '{broken json');

    const { result } = renderHook(() => usePomodoroTimer());

    expect(result.current.phase).toBe('focus');
    expect(result.current.status).toBe('idle');
    expect(result.current.remainingSeconds).toBe(DEFAULT_FOCUS_SECONDS);
    expect(result.current.endTimeMs).toBeNull();
    expect(result.current.completionCount).toBe(0);
  });
});
