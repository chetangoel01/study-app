import { useEffect, useState } from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import type { AppOutletContext } from '../outletContext.js';
import { api } from '../api/client.js';
import type { AuthUser } from '../types.js';
import type { UserPreferences } from '../hooks/useUserSettings.js';
import { applyDashboardDensity, getStoredDashboardDensity } from '../lib/dashboardDensity.js';
import { Layout } from './Layout.js';
import { SessionBanner } from './SessionBanner.js';
import { CurriculumProvider } from '../hooks/useCurriculum.js';

const THEME_STORAGE_KEY = 'me-theme';

function isTheme(theme: unknown): theme is UserPreferences['theme'] {
  return theme === 'light' || theme === 'dark';
}

function getStoredTheme() {
  try {
    return window.localStorage.getItem(THEME_STORAGE_KEY);
  } catch {
    return null;
  }
}

function applyTheme(theme: UserPreferences['theme']) {
  document.documentElement.dataset.theme = theme;

  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Ignore storage failures in constrained environments.
  }
}

function ThemeBootstrap() {
  useEffect(() => {
    let cancelled = false;

    const storedTheme = getStoredTheme();
    if (isTheme(storedTheme)) {
      applyTheme(storedTheme);
    } else {
      applyTheme('light');
    }

    void api.get<UserPreferences>('/api/user/preferences').then((prefs) => {
      if (cancelled || !isTheme(prefs.theme)) return;
      applyTheme(prefs.theme);
    }).catch(() => {
      if (!cancelled && !isTheme(storedTheme)) {
        applyTheme('light');
      }
    });

    const handleThemeChange = (event: Event) => {
      const theme = (event as CustomEvent<{ theme?: unknown }>).detail?.theme;
      if (!isTheme(theme)) return;
      applyTheme(theme);
    };

    window.addEventListener('me-theme-change', handleThemeChange);

    return () => {
      cancelled = true;
      window.removeEventListener('me-theme-change', handleThemeChange);
      document.documentElement.removeAttribute('data-theme');
    };
  }, []);

  return null;
}

function DensityBootstrap() {
  useEffect(() => {
    let cancelled = false;
    const stored = getStoredDashboardDensity();
    applyDashboardDensity(stored ?? 'expansive');

    void api.get<UserPreferences>('/api/user/preferences').then((prefs) => {
      if (cancelled) return;
      applyDashboardDensity(prefs.dashboardDensity === 'dense' ? 'dense' : 'expansive');
    }).catch(() => {});

    return () => {
      cancelled = true;
      document.documentElement.removeAttribute('data-dashboard-density');
    };
  }, []);

  return null;
}

export function ProtectedRoute() {
  const [user, setUser] = useState<AuthUser | null | 'loading'>('loading');
  useEffect(() => {
    api.get<AuthUser>('/api/auth/me').then(setUser).catch(() => setUser(null));
  }, []);
  if (user === 'loading') return <div className="loading" role="status" aria-live="polite">Loading...</div>;
  if (user === null) return <Navigate to="/login" replace />;
  return (
    <Layout user={user}>
      <ThemeBootstrap />
      <DensityBootstrap />
      <SessionBanner />
      <CurriculumProvider>
        <Outlet context={{ user } satisfies AppOutletContext} />
      </CurriculumProvider>
    </Layout>
  );
}
