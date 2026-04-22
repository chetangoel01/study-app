import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route, Outlet } from 'react-router-dom';
import { SchedulePage } from './SchedulePage.js';
import type { AuthUser } from '../types.js';

vi.mock('../api/client.js', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn().mockResolvedValue({}),
    put: vi.fn().mockResolvedValue({}),
  },
}));

vi.mock('../hooks/useMockInterviews.js', () => ({
  useInviteDetail: () => ({ detail: null, loading: false }),
}));

const { api } = await import('../api/client.js');

function renderPage(userOverrides: Partial<AuthUser> = {}) {
  const user: AuthUser = {
    id: 1,
    email: 'u@x.y',
    timezone: 'UTC',
    ...userOverrides,
  };
  return render(
    <MemoryRouter initialEntries={['/schedule']}>
      <Routes>
        <Route element={<OutletHarness user={user} />}>
          <Route path="/schedule" element={<SchedulePage />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

function OutletHarness({ user }: { user: AuthUser }) {
  return <Outlet context={{ user }} />;
}

describe('SchedulePage', () => {
  beforeEach(() => {
    (api.get as any).mockReset();
    (api.post as any).mockReset().mockResolvedValue({});
    (api.put as any).mockReset?.().mockResolvedValue?.({});
  });

  it('loads and shows the agenda', async () => {
    (api.get as any).mockResolvedValue({ invites: [] });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/no upcoming mock interviews/i)).toBeInTheDocument();
    });
    expect(api.get).toHaveBeenCalledWith('/api/schedule');
  });

  it('toggling past switches the query', async () => {
    (api.get as any).mockResolvedValue({ invites: [] });
    renderPage();
    await waitFor(() => expect(api.get).toHaveBeenCalled());
    await userEvent.click(screen.getByRole('button', { name: /show past/i }));
    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('/api/schedule?includePast=true');
    });
  });

  it('shows UTC nudge banner when user.timezone is UTC', async () => {
    (api.get as any).mockResolvedValue({ invites: [] });
    renderPage({ timezone: 'UTC' });
    await waitFor(() => {
      expect(screen.getByText(/times are shown in utc/i)).toBeInTheDocument();
    });
  });

  it('does NOT show UTC nudge when user.timezone is set', async () => {
    (api.get as any).mockResolvedValue({ invites: [] });
    renderPage({ timezone: 'America/New_York' });
    await waitFor(() => expect(api.get).toHaveBeenCalled());
    expect(screen.queryByText(/times are shown in utc/i)).toBeNull();
  });
});
