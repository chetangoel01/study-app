import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { PracticeSetupModal } from './PracticeSetupModal.js';

describe('PracticeSetupModal', () => {
  test('renders form fields with Medium selected by default', () => {
    render(<PracticeSetupModal onClose={vi.fn()} />);
    expect(screen.getByLabelText(/Topic/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Medium' })).toHaveAttribute('aria-pressed', 'true');
  });

  test('changes difficulty selection to Hard', () => {
    render(<PracticeSetupModal onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Hard' }));
    expect(screen.getByRole('button', { name: 'Hard' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Medium' })).toHaveAttribute('aria-pressed', 'false');
  });

  test('calls onClose when Cancel is clicked', () => {
    const onClose = vi.fn();
    render(<PracticeSetupModal onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalled();
  });
});
