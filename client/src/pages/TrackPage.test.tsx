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
  test('shows in-progress status chip for the active module', () => {
    useCurriculumMock.mockReturnValue({
      data: {
        tracks: [{ id: 'dsa-leetcode', label: 'DSA & LeetCode' }],
        modules: [
          {
            id: 'big-o',
            title: 'Big-O',
            summary: 'big-o',
            track: 'dsa-leetcode',
            status: 'in-progress',
            latest_progress_updated_at: '2026-04-14 12:00:00',
            blockedBy: [],
            totalItems: 10,
            completedItems: 3,
            guideStepsTotal: 4,
            guideStepsCompleted: 1,
            items: [],
          },
        ],
      },
      loading: false,
      error: '',
      refetch: vi.fn(),
    });

    renderTrackPage();

    expect(screen.getByText('In Progress')).toBeInTheDocument();
    expect(screen.getByText('Continue session')).toBeInTheDocument();
  });

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
            totalItems: 10,
            completedItems: 0,
            guideStepsTotal: 3,
            guideStepsCompleted: 0,
            items: [],
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
            blockedBy: [],
            totalItems: 10,
            completedItems: 10,
            guideStepsTotal: 0,
            guideStepsCompleted: 0,
            items: [],
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
