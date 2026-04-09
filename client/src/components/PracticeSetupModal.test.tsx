import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { PracticeSetupModal } from './PracticeSetupModal.js';

const tracks = [{ id: 'dsa-leetcode', label: 'DSA & LeetCode' }];

const moduleOptions = [
  {
    moduleId: 'big-o',
    title: 'Big-O and asymptotic analysis',
    trackId: 'dsa-leetcode',
    trackLabel: 'DSA & LeetCode',
  },
];

describe('PracticeSetupModal', () => {
  test('renders form fields with Medium selected by default', () => {
    render(<PracticeSetupModal tracks={tracks} moduleOptions={moduleOptions} onBegin={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByLabelText(/Focus Module/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Medium' })).toHaveAttribute('aria-pressed', 'true');
  });

  test('changes difficulty selection to Hard', () => {
    render(<PracticeSetupModal tracks={tracks} moduleOptions={moduleOptions} onBegin={vi.fn()} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Hard' }));
    expect(screen.getByRole('button', { name: 'Hard' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Medium' })).toHaveAttribute('aria-pressed', 'false');
  });

  test('calls onBegin with the selected module and session settings', () => {
    const onBegin = vi.fn();
    render(<PracticeSetupModal tracks={tracks} moduleOptions={moduleOptions} onBegin={onBegin} onClose={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Hard' }));
    fireEvent.change(screen.getByLabelText(/Duration/), { target: { value: '60' } });
    fireEvent.click(screen.getByRole('button', { name: 'Start Session →' }));

    expect(onBegin).toHaveBeenCalledWith({
      moduleId: 'big-o',
      trackId: 'dsa-leetcode',
      difficulty: 'Hard',
      duration: 60,
    });
  });

  test('calls onClose when Cancel is clicked', () => {
    const onClose = vi.fn();
    render(<PracticeSetupModal tracks={tracks} moduleOptions={moduleOptions} onBegin={vi.fn()} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalled();
  });
});
