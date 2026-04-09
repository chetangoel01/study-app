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

describe('TrackPage', () => {
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
      refetch: vi.fn(),
    });

    renderTrackPage();

    expect(screen.getByText('Start module')).toBeInTheDocument();
  });

  test('does not render the removed refresher footer', () => {
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
        ],
      },
      loading: false,
      error: '',
      refetch: vi.fn(),
    });

    renderTrackPage();

    expect(screen.queryByRole('heading', { name: 'Need a refresher?' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Review past modules' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'View statistics' })).not.toBeInTheDocument();
  });
});
