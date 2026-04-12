import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  DEFAULT_BREAK_SECONDS,
  DEFAULT_FOCUS_SECONDS,
  type PomodoroPhase,
  type PomodoroStatus,
  usePomodoroTimer,
} from '../hooks/usePomodoroTimer.js';

const TOAST_DURATION_MS = 4000;
const COLLAPSE_ANIMATION_MS = 180;

interface TimerSnapshot {
  completionCount: number;
  phase: PomodoroPhase;
  remainingSeconds: number;
  status: PomodoroStatus;
}

interface ToastState {
  id: number;
  message: string;
}

function formatRemainingTime(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function getPhaseLabel(phase: PomodoroPhase) {
  return phase === 'focus' ? 'Focus' : 'Break';
}

function buildReadyMessage(phase: PomodoroPhase, remainingSeconds: number) {
  return `${getPhaseLabel(phase)} timer ready for ${formatRemainingTime(remainingSeconds)}.`;
}

function buildPausedMessage(phase: PomodoroPhase, remainingSeconds: number) {
  return `${getPhaseLabel(phase)} timer paused at ${formatRemainingTime(remainingSeconds)} remaining.`;
}

function buildRunningMessage(phase: PomodoroPhase, remainingSeconds: number) {
  return `${getPhaseLabel(phase)} timer running with ${formatRemainingTime(remainingSeconds)} remaining.`;
}

function buildCompletionMessage(phase: PomodoroPhase) {
  return `${getPhaseLabel(phase)} session complete.`;
}

function ClockIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <polyline points="12 7 12 12 15.5 14.5" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M8 6.82v10.36a1 1 0 0 0 1.53.85l7.77-5.18a1 1 0 0 0 0-1.66L9.53 5.97A1 1 0 0 0 8 6.82Z" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M8 5.75A1.25 1.25 0 0 1 9.25 7v10a1.25 1.25 0 1 1-2.5 0V7A1.25 1.25 0 0 1 8 5.75Zm8 0A1.25 1.25 0 0 1 17.25 7v10a1.25 1.25 0 1 1-2.5 0V7A1.25 1.25 0 0 1 16 5.75Z" />
    </svg>
  );
}

function ResetIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <path d="M3 4v5h5" />
    </svg>
  );
}

function MinimizeIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

export function PomodoroControl() {
  const timer = usePomodoroTimer();
  const [liveMessage, setLiveMessage] = useState(() => buildReadyMessage(timer.phase, timer.remainingSeconds));
  const [toast, setToast] = useState<ToastState | null>(null);
  const [expandedByUser, setExpandedByUser] = useState(false);
  const [isCollapsing, setIsCollapsing] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const collapseTimeoutRef = useRef<number | null>(null);
  const previousSnapshotRef = useRef<TimerSnapshot | null>(null);

  const phaseDurationSeconds = timer.phase === 'focus' ? DEFAULT_FOCUS_SECONDS : DEFAULT_BREAK_SECONDS;
  const isDefaultIdleState = timer.status === 'idle' && timer.remainingSeconds === phaseDurationSeconds;
  const showExpandedShell = expandedByUser || isCollapsing;
  const formattedTime = useMemo(
    () => formatRemainingTime(timer.remainingSeconds),
    [timer.remainingSeconds]
  );
  const phaseLabel = getPhaseLabel(timer.phase);
  const isRunning = timer.status === 'running';
  const phaseClass = timer.phase === 'focus' ? 'is-focus' : 'is-break';
  const showCollapsedCountdown = timer.status === 'running' || timer.status === 'paused' || timer.remainingSeconds === 0;
  const collapsedAriaLabel = showCollapsedCountdown
    ? `Open pomodoro timer. ${phaseLabel} ${timer.status === 'paused' ? 'paused at' : 'with'} ${formattedTime} remaining.`
    : 'Open pomodoro timer';

  useEffect(() => {
    if (!toast) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setToast((currentToast) => (currentToast?.id === toast.id ? null : currentToast));
    }, TOAST_DURATION_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [toast]);

  useEffect(() => {
    const currentSnapshot: TimerSnapshot = {
      completionCount: timer.completionCount,
      phase: timer.phase,
      remainingSeconds: timer.remainingSeconds,
      status: timer.status,
    };
    const previousSnapshot = previousSnapshotRef.current;

    if (previousSnapshot === null) {
      previousSnapshotRef.current = currentSnapshot;
      return;
    }

    if (timer.completionCount > previousSnapshot.completionCount) {
      const message = buildCompletionMessage(timer.phase);
      setLiveMessage(message);
      setToast({ id: timer.completionCount, message });
    } else if (timer.phase !== previousSnapshot.phase) {
      setLiveMessage(buildReadyMessage(timer.phase, timer.remainingSeconds));
    } else if (timer.status !== previousSnapshot.status) {
      if (timer.status === 'running') {
        setLiveMessage(buildRunningMessage(timer.phase, timer.remainingSeconds));
      } else if (timer.status === 'paused') {
        setLiveMessage(buildPausedMessage(timer.phase, timer.remainingSeconds));
      } else {
        setLiveMessage(buildReadyMessage(timer.phase, timer.remainingSeconds));
      }
    } else if (
      timer.status === 'idle'
      && previousSnapshot.status === 'idle'
      && timer.remainingSeconds > previousSnapshot.remainingSeconds
    ) {
      setLiveMessage(buildReadyMessage(timer.phase, timer.remainingSeconds));
    }

    previousSnapshotRef.current = currentSnapshot;
  }, [timer.completionCount, timer.phase, timer.remainingSeconds, timer.status]);

  const startCollapseAnimation = useCallback(() => {
    if (collapseTimeoutRef.current !== null) {
      window.clearTimeout(collapseTimeoutRef.current);
    }

    setIsCollapsing(true);
    collapseTimeoutRef.current = window.setTimeout(() => {
      setIsCollapsing(false);
      collapseTimeoutRef.current = null;
    }, COLLAPSE_ANIMATION_MS);
  }, []);

  const openExpanded = () => {
    if (collapseTimeoutRef.current !== null) {
      window.clearTimeout(collapseTimeoutRef.current);
      collapseTimeoutRef.current = null;
    }

    setIsCollapsing(false);
    setExpandedByUser(true);
  };

  const collapseExpanded = useCallback(() => {
    setExpandedByUser(false);
    startCollapseAnimation();
  }, [startCollapseAnimation]);

  useEffect(() => {
    if (!expandedByUser) {
      return undefined;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        collapseExpanded();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        collapseExpanded();
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [collapseExpanded, expandedByUser]);

  useEffect(() => () => {
    if (collapseTimeoutRef.current !== null) {
      window.clearTimeout(collapseTimeoutRef.current);
      collapseTimeoutRef.current = null;
    }
  }, []);

  const handleReset = () => {
    timer.reset();
    if (!isDefaultIdleState) {
      collapseExpanded();
    }
  };

  if (!showExpandedShell) {
    return (
      <button
        type="button"
        className={`topbar-icon-btn pomodoro-collapsed-btn ${phaseClass}${showCollapsedCountdown ? ' has-time' : ''}`}
        aria-label={collapsedAriaLabel}
        onClick={openExpanded}
      >
        <ClockIcon />
        {showCollapsedCountdown ? (
          <span className="pomodoro-collapsed-time" aria-hidden="true">{formattedTime}</span>
        ) : null}
      </button>
    );
  }

  return (
    <div
      ref={rootRef}
      className={`pomodoro-control ${phaseClass}${isRunning ? ' is-running' : ''}${isCollapsing ? ' is-collapsing' : ''}`}
      role="group"
      aria-label="Pomodoro timer"
    >
      <div className="pomodoro-summary" aria-live="off">
        <span className="pomodoro-time" aria-label={`${formattedTime} remaining`}>
          {formattedTime}
        </span>
      </div>

      <div className="pomodoro-phase-switch" role="group" aria-label="Pomodoro phase">
        <button
          type="button"
          className={`pomodoro-segment-btn${timer.phase === 'focus' ? ' active' : ''}`}
          aria-label="Focus"
          aria-pressed={timer.phase === 'focus'}
          onClick={() => timer.switchPhase('focus')}
        >
          <span className="pomodoro-switch-label">Focus</span>
        </button>
        <button
          type="button"
          className={`pomodoro-segment-btn${timer.phase === 'break' ? ' active' : ''}`}
          aria-label="Break"
          aria-pressed={timer.phase === 'break'}
          onClick={() => timer.switchPhase('break')}
        >
          <span className="pomodoro-switch-label">Break</span>
        </button>
      </div>

      <div className="pomodoro-control-actions">
        <button
          type="button"
          className={`pomodoro-icon-btn pomodoro-toggle-btn${isRunning ? ' active' : ''}`}
          aria-label={`${isRunning ? 'Pause' : 'Start'} ${phaseLabel.toLowerCase()} timer`}
          onClick={isRunning ? timer.pause : timer.start}
        >
          {isRunning ? <PauseIcon /> : <PlayIcon />}
        </button>
        <button
          type="button"
          className="pomodoro-icon-btn"
          aria-label={`Reset ${phaseLabel.toLowerCase()} timer`}
          onClick={handleReset}
        >
          <ResetIcon />
        </button>
        <button
          type="button"
          className="pomodoro-icon-btn"
          aria-label="Minimize pomodoro timer"
          onClick={collapseExpanded}
        >
          <MinimizeIcon />
        </button>
      </div>

      {toast ? (
        <div className="pomodoro-toast" aria-hidden="true">
          {toast.message}
        </div>
      ) : null}

      <span className="sr-only" aria-live="polite" aria-atomic="true">
        {liveMessage}
      </span>
    </div>
  );
}
