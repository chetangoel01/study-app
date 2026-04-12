import { useCallback, useEffect, useState } from 'react';

export type PomodoroPhase = 'focus' | 'break';
export type PomodoroStatus = 'idle' | 'running' | 'paused';

interface PomodoroPersistedState {
  phase: PomodoroPhase;
  status: PomodoroStatus;
  remainingSeconds: number;
  endTimeMs: number | null;
}

interface PomodoroTimerState extends PomodoroPersistedState {
  completionCount: number;
}

export interface UsePomodoroTimerResult extends PomodoroTimerState {
  start: () => void;
  pause: () => void;
  reset: () => void;
  switchPhase: (nextPhase?: PomodoroPhase) => void;
}

export const POMODORO_STORAGE_KEY = 'me-pomodoro';
export const DEFAULT_FOCUS_SECONDS = 25 * 60;
export const DEFAULT_BREAK_SECONDS = 5 * 60;

const DEFAULT_PHASE: PomodoroPhase = 'focus';
const TICK_INTERVAL_MS = 250;

function getPhaseDurationSeconds(phase: PomodoroPhase) {
  return phase === 'focus' ? DEFAULT_FOCUS_SECONDS : DEFAULT_BREAK_SECONDS;
}

function isPhase(value: unknown): value is PomodoroPhase {
  return value === 'focus' || value === 'break';
}

function isStatus(value: unknown): value is PomodoroStatus {
  return value === 'idle' || value === 'running' || value === 'paused';
}

function getRemainingSecondsFromEndTime(endTimeMs: number, nowMs = Date.now()) {
  return Math.max(0, Math.ceil((endTimeMs - nowMs) / 1000));
}

function createBaseState(phase: PomodoroPhase = DEFAULT_PHASE): PomodoroTimerState {
  return {
    phase,
    status: 'idle',
    remainingSeconds: getPhaseDurationSeconds(phase),
    endTimeMs: null,
    completionCount: 0,
  };
}

function createCompletedState(phase: PomodoroPhase, completionCount: number): PomodoroTimerState {
  return {
    phase,
    status: 'idle',
    remainingSeconds: 0,
    endTimeMs: null,
    completionCount,
  };
}

function persistState(state: PomodoroPersistedState) {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(POMODORO_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage failures in constrained environments.
  }
}

function clearPersistedState() {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.removeItem(POMODORO_STORAGE_KEY);
  } catch {
    // Ignore storage failures in constrained environments.
  }
}

function readPersistedState(): PomodoroTimerState {
  if (typeof window === 'undefined') return createBaseState();

  try {
    const raw = window.localStorage.getItem(POMODORO_STORAGE_KEY);
    if (!raw) return createBaseState();

    const parsed = JSON.parse(raw) as Partial<PomodoroPersistedState>;
    if (!parsed || typeof parsed !== 'object') {
      clearPersistedState();
      return createBaseState();
    }

    const phase = isPhase(parsed.phase) ? parsed.phase : DEFAULT_PHASE;
    const durationSeconds = getPhaseDurationSeconds(phase);
    const status = isStatus(parsed.status) ? parsed.status : 'idle';
    const remainingSeconds = typeof parsed.remainingSeconds === 'number' && Number.isFinite(parsed.remainingSeconds)
      ? Math.max(0, Math.min(durationSeconds, Math.floor(parsed.remainingSeconds)))
      : durationSeconds;
    const endTimeMs = typeof parsed.endTimeMs === 'number' && Number.isFinite(parsed.endTimeMs)
      ? parsed.endTimeMs
      : null;

    if (status === 'running') {
      if (endTimeMs === null) {
        clearPersistedState();
        return createBaseState();
      }

      const derivedRemainingSeconds = getRemainingSecondsFromEndTime(endTimeMs);
      if (derivedRemainingSeconds === 0) {
        return createCompletedState(phase, 1);
      }

      return {
        phase,
        status,
        remainingSeconds: derivedRemainingSeconds,
        endTimeMs,
        completionCount: 0,
      };
    }

    return {
      phase,
      status,
      remainingSeconds,
      endTimeMs: null,
      completionCount: 0,
    };
  } catch {
    clearPersistedState();
    return createBaseState();
  }
}

export function usePomodoroTimer(): UsePomodoroTimerResult {
  const [timerState, setTimerState] = useState<PomodoroTimerState>(() => readPersistedState());

  useEffect(() => {
    persistState({
      phase: timerState.phase,
      status: timerState.status,
      remainingSeconds: timerState.remainingSeconds,
      endTimeMs: timerState.endTimeMs,
    });
  }, [timerState.endTimeMs, timerState.phase, timerState.remainingSeconds, timerState.status]);

  useEffect(() => {
    if (timerState.status !== 'running' || timerState.endTimeMs === null) return;

    const syncRunningState = () => {
      setTimerState((current) => {
        if (current.status !== 'running' || current.endTimeMs !== timerState.endTimeMs) {
          return current;
        }

        const endTimeMs = current.endTimeMs;
        if (endTimeMs === null) {
          return current;
        }

        const remainingSeconds = getRemainingSecondsFromEndTime(endTimeMs);
        if (remainingSeconds === 0) {
          return createCompletedState(current.phase, current.completionCount + 1);
        }

        if (current.remainingSeconds === remainingSeconds) {
          return current;
        }

        return { ...current, remainingSeconds };
      });
    };

    syncRunningState();
    const intervalId = window.setInterval(syncRunningState, TICK_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [timerState.endTimeMs, timerState.status]);

  const start = useCallback(() => {
    setTimerState((current) => {
      if (current.status === 'running' && current.endTimeMs !== null) {
        return current;
      }

      const remainingSeconds = current.remainingSeconds > 0
        ? current.remainingSeconds
        : getPhaseDurationSeconds(current.phase);

      return {
        ...current,
        status: 'running',
        remainingSeconds,
        endTimeMs: Date.now() + (remainingSeconds * 1000),
      };
    });
  }, []);

  const pause = useCallback(() => {
    setTimerState((current) => {
      if (current.status !== 'running' || current.endTimeMs === null) {
        return current;
      }

      return {
        ...current,
        status: 'paused',
        remainingSeconds: getRemainingSecondsFromEndTime(current.endTimeMs),
        endTimeMs: null,
      };
    });
  }, []);

  const reset = useCallback(() => {
    setTimerState((current) => ({
      ...current,
      status: 'idle',
      remainingSeconds: getPhaseDurationSeconds(current.phase),
      endTimeMs: null,
    }));
  }, []);

  const switchPhase = useCallback((nextPhase?: PomodoroPhase) => {
    setTimerState((current) => {
      const phase = nextPhase ?? (current.phase === 'focus' ? 'break' : 'focus');

      return {
        ...current,
        phase,
        status: 'idle',
        remainingSeconds: getPhaseDurationSeconds(phase),
        endTimeMs: null,
      };
    });
  }, []);

  return {
    phase: timerState.phase,
    status: timerState.status,
    remainingSeconds: timerState.remainingSeconds,
    endTimeMs: timerState.endTimeMs,
    completionCount: timerState.completionCount,
    start,
    pause,
    reset,
    switchPhase,
  };
}
