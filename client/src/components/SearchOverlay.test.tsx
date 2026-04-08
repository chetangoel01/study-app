import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, test, vi } from 'vitest';
import { SearchOverlay } from './SearchOverlay.js';

vi.mock('../hooks/useCurriculum', () => ({
  useCurriculum: () => ({
    data: {
      modules: [
        {
          id: 'trees',
          title: 'Trees & BSTs',
          summary: 'binary trees',
          track: 'dsa-leetcode',
          status: 'available',
        },
      ],
      tracks: [],
    },
    loading: false,
    error: null,
  }),
}));

describe('SearchOverlay', () => {
  test('renders search input on mount', () => {
    render(<MemoryRouter><SearchOverlay onClose={vi.fn()} /></MemoryRouter>);
    expect(screen.getByRole('searchbox', { name: 'Search' })).toBeInTheDocument();
  });

  test('shows matching module when typing', () => {
    render(<MemoryRouter><SearchOverlay onClose={vi.fn()} /></MemoryRouter>);
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'Trees' } });
    expect(screen.getByText('Trees & BSTs')).toBeInTheDocument();
  });

  test('calls onClose on Escape key', () => {
    const onClose = vi.fn();
    render(<MemoryRouter><SearchOverlay onClose={onClose} /></MemoryRouter>);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });
});
