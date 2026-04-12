import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { DEFAULT_BREAK_SECONDS } from '../hooks/usePomodoroTimer.js';
import { PomodoroControl } from './PomodoroControl.js';

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

describe('PomodoroControl', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-11T14:00:00.000Z'));
    vi.stubGlobal('localStorage', createLocalStorageMock());
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  test('renders as a collapsed clock icon until opened', () => {
    render(<PomodoroControl />);

    expect(screen.getByRole('button', { name: /open pomodoro timer/i })).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Pomodoro timer' })).not.toBeInTheDocument();
  });

  test('expands to show the current phase, remaining time, and controls', () => {
    render(<PomodoroControl />);
    fireEvent.click(screen.getByRole('button', { name: /open pomodoro timer/i }));

    expect(screen.getByRole('group', { name: 'Pomodoro timer' })).toBeInTheDocument();
    expect(screen.getByText('25:00')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start focus timer' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reset focus timer' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Focus' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Break' })).toHaveAttribute('aria-pressed', 'false');
  });

  test('starts, pauses, and resets the active timer deterministically', () => {
    render(<PomodoroControl />);
    fireEvent.click(screen.getByRole('button', { name: /open pomodoro timer/i }));

    fireEvent.click(screen.getByRole('button', { name: 'Start focus timer' }));
    expect(screen.getByRole('button', { name: 'Pause focus timer' })).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(62_000);
    });

    expect(screen.getByText('23:58')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Pause focus timer' }));

    act(() => {
      vi.advanceTimersByTime(15_000);
    });

    expect(screen.getByText('23:58')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Reset focus timer' }));
    expect(screen.getByRole('group', { name: 'Pomodoro timer' })).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(screen.getByRole('button', { name: /open pomodoro timer/i })).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Pomodoro timer' })).not.toBeInTheDocument();
  });

  test('switches phase quickly and shows a completion toast that dismisses itself', () => {
    const { container } = render(<PomodoroControl />);
    fireEvent.click(screen.getByRole('button', { name: /open pomodoro timer/i }));

    fireEvent.click(screen.getByRole('button', { name: 'Break' }));

    expect(screen.getByText('05:00')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start break timer' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Start break timer' }));

    act(() => {
      vi.advanceTimersByTime(DEFAULT_BREAK_SECONDS * 1000);
    });

    expect(screen.getByRole('button', { name: 'Start break timer' })).toBeInTheDocument();
    expect(screen.getByText('00:00')).toBeInTheDocument();

    const toast = container.querySelector('.pomodoro-toast');
    expect(toast).not.toBeNull();
    expect(toast).toHaveTextContent('Break session complete.');

    act(() => {
      vi.advanceTimersByTime(4_000);
    });

    expect(container.querySelector('.pomodoro-toast')).toBeNull();
  });

  test('shows a live countdown when minimized after timer has started', () => {
    render(<PomodoroControl />);
    fireEvent.click(screen.getByRole('button', { name: /open pomodoro timer/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Start focus timer' }));

    act(() => {
      vi.advanceTimersByTime(62_000);
    });

    fireEvent.click(screen.getByRole('button', { name: 'Minimize pomodoro timer' }));

    act(() => {
      vi.advanceTimersByTime(200);
    });

    const collapsedButton = screen.getByRole('button', { name: /open pomodoro timer/i });
    expect(collapsedButton).toHaveTextContent('23:58');

    act(() => {
      vi.advanceTimersByTime(5_000);
    });

    expect(collapsedButton).toHaveTextContent('23:53');
  });
});
