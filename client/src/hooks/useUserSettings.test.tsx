import { renderHook, act, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { api } from '../api/client.js';
import { useUserSettings } from './useUserSettings.js';

vi.mock('../api/client.js', () => ({
  api: {
    get: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
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

describe('useUserSettings', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createLocalStorageMock());
    document.documentElement.dataset.theme = '';
    vi.mocked(api.get).mockReset();
    vi.mocked(api.put).mockReset();
    vi.mocked(api.delete).mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    document.documentElement.dataset.theme = '';
  });

  test('persists theme changes to localStorage and broadcasts them', async () => {
    vi.mocked(api.get).mockImplementation((path: string) => {
      if (path === '/api/user/profile') {
        return Promise.resolve({ email: 'alex@example.com', fullName: 'Alex', bio: 'Builder' }) as never;
      }

      if (path === '/api/user/preferences') {
        return Promise.resolve({
          theme: 'light',
          notifyDailyChallenge: true,
          notifyWeeklyProgress: false,
          notifyCommunity: true,
          dashboardDensity: 'expansive',
        }) as never;
      }

      if (path === '/api/user/oauth-connections') {
        return Promise.resolve({ google: false, github: false }) as never;
      }

      throw new Error(`Unexpected path: ${path}`);
    });

    vi.mocked(api.put).mockResolvedValue(undefined as never);

    const events: Array<{ theme: string }> = [];
    const handleThemeChange = (event: Event) => {
      events.push((event as CustomEvent<{ theme: string }>).detail);
    };

    window.addEventListener('me-theme-change', handleThemeChange);

    const { result } = renderHook(() => useUserSettings());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.savePreferences({ theme: 'dark' });
    });

    expect(window.localStorage.getItem('me-theme')).toBe('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(events).toEqual([{ theme: 'dark' }]);
    expect(vi.mocked(api.put)).toHaveBeenCalledWith('/api/user/preferences', { theme: 'dark' });

    window.removeEventListener('me-theme-change', handleThemeChange);
  });
});
