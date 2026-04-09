import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, test, vi } from 'vitest';
import { ModulePage } from './ModulePage.js';

const scenario = { current: 'loading' as 'loading' | 'available' };

vi.mock('../api/client.js', () => ({
  api: {
    get: vi.fn().mockResolvedValue({ content: '' }),
    put: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../hooks/useCurriculum', () => ({
  useCurriculum: () => {
    if (scenario.current === 'loading') {
      return { data: null, loading: true, error: '', refetch: vi.fn() };
    }

    return {
      data: {
        tracks: [{ id: 'dsa-leetcode', label: 'DSA & LeetCode' }],
        modules: [
          {
            id: 'big-o',
            title: 'Big-O and asymptotic analysis',
            track: 'dsa-leetcode',
            phase: 'Core Track',
            summary: 'Reason about runtime and space costs.',
            estimate: '2-4 sessions',
            sessions: 4,
            countsTowardSchedule: true,
            sourceUrl: 'https://example.com',
            prerequisiteModuleIds: [],
            items: [
              { id: 'big-o:read:0', type: 'read', label: 'Read Big-O notes', url: null },
              { id: 'big-o:do:0', type: 'do', label: 'Solve one complexity problem', url: null },
            ],
            totalItems: 2,
            completedItems: 0,
            status: 'available',
            blockedBy: [],
            latest_progress_updated_at: null,
          },
        ],
      },
      loading: false,
      error: '',
      refetch: vi.fn(),
    };
  },
  useModuleContent: () => {
    if (scenario.current === 'loading') {
      return { data: null, loading: true, error: '' };
    }

    return {
      data: {
        moduleId: 'big-o',
        items: [
          { id: 'big-o:read:0', type: 'read', label: 'Read Big-O notes', url: null },
          { id: 'big-o:do:0', type: 'do', label: 'Solve one complexity problem', url: null },
        ],
        topics: [
          { id: 'big-o-topic', label: 'Complexity intuition', study_guide_markdown: 'Big-O notes' },
        ],
      },
      loading: false,
      error: '',
    };
  },
}));

vi.mock('../hooks/useProgress', () => ({
  useProgress: () => ({
    toggle: vi.fn(),
    isCompleted: () => false,
    isPending: () => false,
    error: '',
    statusMessage: '',
    clearError: vi.fn(),
  }),
}));

describe('ModulePage', () => {
  test('does not crash when the module loads after an initial loading render', async () => {
    const view = render(
      <MemoryRouter initialEntries={['/track/dsa-leetcode/module/big-o']}>
        <Routes>
          <Route path="/track/:trackId/module/:moduleId" element={<ModulePage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByRole('status')).toHaveTextContent('Loading...');

    scenario.current = 'available';
    view.rerender(
      <MemoryRouter initialEntries={['/track/dsa-leetcode/module/big-o']}>
        <Routes>
          <Route path="/track/:trackId/module/:moduleId" element={<ModulePage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByRole('heading', { name: 'Big-O and asymptotic analysis' })).toBeInTheDocument();
  });

  test('renders section sidebar without the removed launchpad block', async () => {
    scenario.current = 'available';

    render(
      <MemoryRouter initialEntries={['/track/dsa-leetcode/module/big-o']}>
        <Routes>
          <Route path="/track/:trackId/module/:moduleId" element={<ModulePage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByRole('heading', { name: 'Big-O and asymptotic analysis' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Begin with Complexity intuition' })).not.toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Section navigation' })).toBeInTheDocument();
  });
});
