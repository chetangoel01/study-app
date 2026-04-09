import { render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { api } from '../api/client.js';
import { ProtectedRoute } from './ProtectedRoute.js';

vi.mock('../api/client.js', () => ({
  api: {
    get: vi.fn(),
  },
}));

vi.mock('./Layout.js', () => ({
  Layout: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock('./SessionBanner.js', () => ({
  SessionBanner: () => null,
}));

function createLocalStorageMock() {
  const store = new Map<string, string>();

  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
  } as Storage;
}

describe('ProtectedRoute theme bootstrap', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createLocalStorageMock());
    document.documentElement.dataset.theme = '';
    document.documentElement.removeAttribute('data-dashboard-density');
    vi.mocked(api.get).mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    document.documentElement.dataset.theme = '';
    document.documentElement.removeAttribute('data-dashboard-density');
  });

  test('applies saved theme, then syncs the server preference and reacts to theme events', async () => {
    type Preferences = {
      theme: 'light' | 'dark';
      notifyDailyChallenge: boolean;
      notifyWeeklyProgress: boolean;
      notifyCommunity: boolean;
      dashboardDensity: 'dense' | 'expansive';
    };

    let resolvePreferences!: (value: Preferences) => void;
    const preferencesPromise = new Promise<Preferences>((resolve) => {
      resolvePreferences = resolve;
    });

    window.localStorage.setItem('me-theme', 'dark');

    vi.mocked(api.get).mockImplementation((path: string) => {
      if (path === '/api/auth/me') {
        return Promise.resolve({ id: 1, email: 'alex@example.com' }) as never;
      }

      if (path === '/api/user/preferences') {
        return preferencesPromise as never;
      }

      if (path === '/api/curriculum') {
        return Promise.resolve({ tracks: [], modules: [] }) as never;
      }

      throw new Error(`Unexpected path: ${path}`);
    });

    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<div>dashboard</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    await screen.findByText('dashboard');
    expect(document.documentElement.dataset.theme).toBe('dark');

    resolvePreferences({
      theme: 'light',
      notifyDailyChallenge: true,
      notifyWeeklyProgress: false,
      notifyCommunity: true,
      dashboardDensity: 'expansive',
    });

    await waitFor(() => {
      expect(document.documentElement.dataset.theme).toBe('light');
      expect(window.localStorage.getItem('me-theme')).toBe('light');
      expect(document.documentElement.dataset.dashboardDensity).toBe('expansive');
      expect(window.localStorage.getItem('me-dashboard-density')).toBe('expansive');
    });

    window.dispatchEvent(new CustomEvent('me-theme-change', { detail: { theme: 'dark' } }));

    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(window.localStorage.getItem('me-theme')).toBe('dark');
  });
});
