import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, test, vi } from 'vitest';
import { TrackPage } from './TrackPage.js';

const useCurriculumMock = vi.fn();

vi.mock('../hooks/useCurriculum', () => ({
  useCurriculum: () => useCurriculumMock(),
}));

function renderTrackPage() {
  return render(
    <MemoryRouter initialEntries={['/track/dsa-leetcode']}>
      <Routes>
        <Route path="/track/:trackId" element={<TrackPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('TrackPage refresher CTAs', () => {
  test('shows a clear start CTA for available modules', () => {
    useCurriculumMock.mockReturnValue({
      data: {
        tracks: [{ id: 'dsa-leetcode', label: 'DSA & LeetCode' }],
        modules: [
          {
            id: 'big-o',
            title: 'Big-O',
            summary: 'big-o',
            track: 'dsa-leetcode',
            status: 'available',
            latest_progress_updated_at: null,
            blockedBy: [],
          },
        ],
      },
      loading: false,
      error: '',
    });

    renderTrackPage();

    expect(screen.getByText('Start module')).toBeInTheDocument();
  });

  test('links Review Past Modules to the most recently completed module by timestamp', () => {
    useCurriculumMock.mockReturnValue({
      data: {
        tracks: [{ id: 'dsa-leetcode', label: 'DSA & LeetCode' }],
        modules: [
          {
            id: 'arrays',
            title: 'Arrays',
            summary: 'arrays',
            track: 'dsa-leetcode',
            status: 'done',
            latest_progress_updated_at: '2026-04-08T10:00:00.000Z',
          },
          {
            id: 'trees',
            title: 'Trees',
            summary: 'trees',
            track: 'dsa-leetcode',
            status: 'done',
            latest_progress_updated_at: '2026-04-07T10:00:00.000Z',
          },
        ],
      },
      loading: false,
      error: '',
    });

    renderTrackPage();

    expect(screen.getByRole('link', { name: 'Review past modules' }))
      .toHaveAttribute('href', '/track/dsa-leetcode/module/arrays');
    expect(screen.getByRole('link', { name: 'View statistics' }))
      .toHaveAttribute('href', '/');
  });

  test('falls back to the last completed module in track order when timestamps are missing', () => {
    useCurriculumMock.mockReturnValue({
      data: {
        tracks: [{ id: 'dsa-leetcode', label: 'DSA & LeetCode' }],
        modules: [
          {
            id: 'arrays',
            title: 'Arrays',
            summary: 'arrays',
            track: 'dsa-leetcode',
            status: 'done',
            latest_progress_updated_at: null,
          },
          {
            id: 'trees',
            title: 'Trees',
            summary: 'trees',
            track: 'dsa-leetcode',
            status: 'done',
            latest_progress_updated_at: null,
          },
          {
            id: 'graphs',
            title: 'Graphs',
            summary: 'graphs',
            track: 'dsa-leetcode',
            status: 'available',
            latest_progress_updated_at: null,
          },
        ],
      },
      loading: false,
      error: '',
    });

    renderTrackPage();

    expect(screen.getByRole('link', { name: 'Review past modules' }))
      .toHaveAttribute('href', '/track/dsa-leetcode/module/trees');
  });

  test('hides Review Past Modules when no modules are completed', () => {
    useCurriculumMock.mockReturnValue({
      data: {
        tracks: [{ id: 'dsa-leetcode', label: 'DSA & LeetCode' }],
        modules: [
          {
            id: 'arrays',
            title: 'Arrays',
            summary: 'arrays',
            track: 'dsa-leetcode',
            status: 'available',
            latest_progress_updated_at: null,
          },
        ],
      },
      loading: false,
      error: '',
    });

    renderTrackPage();

    expect(screen.queryByRole('link', { name: 'Review past modules' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View statistics' })).toHaveAttribute('href', '/');
  });
});
