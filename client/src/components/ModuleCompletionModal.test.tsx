import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, test, vi } from 'vitest';
import { ModuleCompletionModal } from './ModuleCompletionModal.js';

const props = {
  moduleTitle: 'Trees & Binary Search',
  checksDone: 3,
  nextModuleId: 'heaps',
  nextModuleTitle: 'Heaps',
  trackId: 'dsa-leetcode',
  onClose: vi.fn(),
};

describe('ModuleCompletionModal', () => {
  test('renders module title and stats', () => {
    render(<MemoryRouter><ModuleCompletionModal {...props} /></MemoryRouter>);
    expect(screen.getByText('Trees & Binary Search')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  test('renders next module link', () => {
    render(<MemoryRouter><ModuleCompletionModal {...props} /></MemoryRouter>);
    expect(screen.getByRole('link', { name: /Next Module: Heaps/ })).toBeInTheDocument();
  });

  test('calls onClose when Return to Roadmap is clicked', () => {
    const onClose = vi.fn();
    render(<MemoryRouter><ModuleCompletionModal {...props} onClose={onClose} /></MemoryRouter>);
    fireEvent.click(screen.getByRole('link', { name: /Return to Roadmap/ }));
    expect(onClose).toHaveBeenCalled();
  });
});
