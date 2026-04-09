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
        {
          id: 'ml-trees',
          title: 'Trees for Machine Learning',
          summary: 'feature trees',
          track: 'machine-learning',
          status: 'available',
        },
      ],
      tracks: [
        { id: 'dsa-leetcode', label: 'DSA / LeetCode' },
        { id: 'machine-learning', label: 'Machine Learning' },
      ],
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

  test('filters results by selected track', () => {
    render(<MemoryRouter><SearchOverlay onClose={vi.fn()} /></MemoryRouter>);

    expect(screen.getByRole('button', { name: 'All Tracks' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Machine Learning' }));
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'Trees' } });

    expect(screen.queryByText('Trees & BSTs')).not.toBeInTheDocument();
    expect(screen.getByText('Trees for Machine Learning')).toBeInTheDocument();
  });

  test('calls onClose on Escape key', () => {
    const onClose = vi.fn();
    render(<MemoryRouter><SearchOverlay onClose={onClose} /></MemoryRouter>);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });
});
