import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { InviteDetailModal } from './InviteDetailModal';
import type { InviteDetail } from '../../types.js';

const detail: InviteDetail = {
  id: '1', direction: 'sent',
  counterparty: { id: '2', fullName: 'Bob Brown', initials: 'BB' },
  status: 'accepted', scheduledFor: '2026-05-01T14:00:00Z', durationMinutes: 45,
  topic: 'DSA', rolePreference: 'interviewer', sourceBlockId: null,
  createdAt: '2026-04-20T10:00:00Z', updatedAt: '2026-04-20T11:00:00Z',
  events: [
    { id: 'e1', actorId: '1', eventType: 'created', payload: null, createdAt: '2026-04-20T10:00:00Z' },
    { id: 'e2', actorId: '2', eventType: 'accepted', payload: null, createdAt: '2026-04-20T11:00:00Z' },
  ],
};

describe('InviteDetailModal', () => {
  it('renders timeline in chronological order', () => {
    render(<InviteDetailModal detail={detail} onClose={() => {}} onAction={async () => {}} callerId="1" />);
    const timeline = screen.getByRole('list', { name: /timeline/i });
    const items = within(timeline).getAllByRole('listitem');
    expect(items[0].textContent).toMatch(/created/i);
    expect(items[1].textContent).toMatch(/accepted/i);
  });
});
