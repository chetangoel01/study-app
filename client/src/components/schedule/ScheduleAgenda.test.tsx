import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ScheduleAgenda } from './ScheduleAgenda.js';
import type { InviteSummary } from '../../types.js';

function makeInvite(overrides: Partial<InviteSummary> = {}): InviteSummary {
  return {
    id: String(Math.random()),
    direction: 'received',
    counterparty: { id: '2', fullName: 'Bob', initials: 'B' },
    status: 'accepted',
    scheduledFor: new Date(Date.now() + 86_400_000).toISOString(),
    durationMinutes: 45,
    topic: 'T',
    rolePreference: 'either',
    sourceBlockId: null,
    createdAt: '',
    updatedAt: '',
    ...overrides,
  };
}

describe('ScheduleAgenda', () => {
  it('renders upcoming-empty state when no invites and showPast is false', () => {
    render(<ScheduleAgenda invites={[]} tz="UTC" showPast={false} onAction={vi.fn()} onOpenDetail={vi.fn()} />);
    expect(screen.getByText(/no upcoming mock interviews/i)).toBeInTheDocument();
  });

  it('renders past-empty state when no invites and showPast is true', () => {
    render(<ScheduleAgenda invites={[]} tz="UTC" showPast={true} onAction={vi.fn()} onOpenDetail={vi.fn()} />);
    expect(screen.getByText(/no past interviews/i)).toBeInTheDocument();
  });

  it('renders a day-heading per group', () => {
    const today = new Date().toISOString();
    const tomorrow = new Date(Date.now() + 86_400_000).toISOString();
    render(
      <ScheduleAgenda
        invites={[makeInvite({ scheduledFor: today }), makeInvite({ scheduledFor: tomorrow })]}
        tz={Intl.DateTimeFormat().resolvedOptions().timeZone}
        showPast={false}
        onAction={vi.fn()}
        onOpenDetail={vi.fn()}
      />,
    );
    expect(screen.getByRole('heading', { name: /today/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /tomorrow/i })).toBeInTheDocument();
  });
});
