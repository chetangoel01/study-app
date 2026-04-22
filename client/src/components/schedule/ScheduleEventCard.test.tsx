import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ScheduleEventCard } from './ScheduleEventCard.js';
import type { InviteSummary } from '../../types.js';

const futureIso = new Date(Date.now() + 86_400_000).toISOString();

function makeInvite(overrides: Partial<InviteSummary> = {}): InviteSummary {
  return {
    id: '1',
    direction: 'received',
    counterparty: { id: '2', fullName: 'Bob', initials: 'B' },
    status: 'pending_acceptance',
    scheduledFor: futureIso,
    durationMinutes: 45,
    topic: 'System design',
    rolePreference: 'either',
    sourceBlockId: null,
    createdAt: '',
    updatedAt: '',
    ...overrides,
  };
}

describe('ScheduleEventCard', () => {
  it('shows Accept/Decline/Reschedule/Details for received pending invites', () => {
    render(<ScheduleEventCard invite={makeInvite({ direction: 'received', status: 'pending_acceptance' })} tz="UTC" onAction={vi.fn()} onOpenDetail={vi.fn()} />);
    expect(screen.getByRole('button', { name: /accept/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /decline/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reschedule/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /details/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /add to calendar/i })).toBeNull();
  });

  it('shows Cancel/Reschedule/Details for sent pending invites', () => {
    render(<ScheduleEventCard invite={makeInvite({ direction: 'sent', status: 'pending_acceptance' })} tz="UTC" onAction={vi.fn()} onOpenDetail={vi.fn()} />);
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reschedule/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /accept/i })).toBeNull();
  });

  it('shows Add to calendar/Reschedule/Cancel/Details for accepted invites', () => {
    render(<ScheduleEventCard invite={makeInvite({ status: 'accepted' })} tz="UTC" onAction={vi.fn()} onOpenDetail={vi.fn()} />);
    expect(screen.getByRole('link', { name: /add to calendar/i })).toHaveAttribute('href', '/api/schedule/ics/1');
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
  });

  it('calls onAction("accept", id) when Accept is clicked', async () => {
    const onAction = vi.fn();
    render(<ScheduleEventCard invite={makeInvite()} tz="UTC" onAction={onAction} onOpenDetail={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: /accept/i }));
    expect(onAction).toHaveBeenCalledWith('accept', '1');
  });

  it('renders counterparty name and topic', () => {
    render(<ScheduleEventCard invite={makeInvite()} tz="UTC" onAction={vi.fn()} onOpenDetail={vi.fn()} />);
    expect(screen.getByText('Bob')).toBeInTheDocument();
    expect(screen.getByText(/System design/)).toBeInTheDocument();
  });
});
