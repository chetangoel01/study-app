import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, test } from 'vitest';
import { TrackColumn } from './TrackColumn.js';
import type { CurriculumModule, Track } from '../types.js';

const TRACK: Track = { id: 'dsa-leetcode', label: 'DSA & LeetCode' };

function makeModule(overrides: Partial<CurriculumModule>): CurriculumModule {
  return {
    id: 'module',
    title: 'Module',
    track: 'dsa-leetcode',
    phase: 'Core',
    summary: 'Summary',
    estimate: '1 session',
    sessions: 1,
    countsTowardSchedule: true,
    sourceUrl: 'https://example.com',
    prerequisiteModuleIds: [],
    items: [],
    totalItems: 3,
    completedItems: 0,
    status: 'available',
    blockedBy: [],
    latest_progress_updated_at: null,
    guideStepsCompleted: 0,
    guideStepsTotal: 0,
    maxGuideStep: 0,
    ...overrides,
  };
}

describe('TrackColumn', () => {
  test('prioritizes in-progress module and labels current session', () => {
    const modules: CurriculumModule[] = [
      makeModule({ id: 'first-available', title: 'First Available', status: 'available' }),
      makeModule({
        id: 'in-progress',
        title: 'In Progress Module',
        status: 'in-progress',
        latest_progress_updated_at: '2026-04-14 11:00:00',
      }),
      makeModule({ id: 'second-available', title: 'Second Available', status: 'available' }),
    ];

    const { container } = render(
      <MemoryRouter>
        <TrackColumn track={TRACK} modules={modules} />
      </MemoryRouter>,
    );

    expect(screen.getByText('Current and next')).toBeInTheDocument();
    expect(screen.getByText('Current session')).toBeInTheDocument();

    const titles = [...container.querySelectorAll('.track-col-next-title')].map((node) => node.textContent?.trim());
    expect(titles[0]).toBe('In Progress Module');
    expect(titles[1]).toBe('First Available');
  });
});
