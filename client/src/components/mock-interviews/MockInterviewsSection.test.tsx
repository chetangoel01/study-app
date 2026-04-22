import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MockInterviewsSection } from './MockInterviewsSection';

vi.mock('../../hooks/useMockInterviews', () => ({
  useMockInterviewPeers: () => ({ peers: [], loading: false }),
  useInvites: () => ({
    invites: [],
    loading: false,
    refresh: vi.fn(), schedule: vi.fn(), accept: vi.fn(),
    decline: vi.fn(), cancel: vi.fn(), reschedule: vi.fn(),
  }),
  useInviteDetail: () => ({ detail: null, loading: false }),
}));
vi.mock('../../hooks/useAvailability', () => ({
  useMyAvailability: () => ({ data: { proposals: [] }, loading: false, refresh: vi.fn(), create: vi.fn(), cancelBlock: vi.fn(), cancelProposal: vi.fn() }),
  useFeed: () => ({ blocks: [], loading: false, refresh: vi.fn(), claim: vi.fn() }),
}));

describe('MockInterviewsSection', () => {
  it('renders empty states for all four cards', () => {
    render(<MockInterviewsSection callerId="1" defaultRolePreference="either" userTimezone="UTC" />);
    expect(screen.getByText(/Nothing waiting on you/i)).toBeInTheDocument();
    expect(screen.getByText(/haven't sent any invites/i)).toBeInTheDocument();
    expect(screen.getByText(/Post a few time blocks/i)).toBeInTheDocument();
    expect(screen.getByText(/No open availability/i)).toBeInTheDocument();
  });
});
