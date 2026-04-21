import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client.js';
import { applyDashboardDensity } from '../lib/dashboardDensity.js';
import type { DashboardDensity } from '../lib/dashboardDensity.js';
import type { RolePreference } from '../types.js';

export interface UserProfile {
  email: string;
  fullName: string;
  bio: string;
}

export interface UserPreferences {
  theme: 'light' | 'dark';
  notifyDailyChallenge: boolean;
  notifyWeeklyProgress: boolean;
  notifyCommunity: boolean;
  dashboardDensity: DashboardDensity;
  allowMockInterviews: boolean;
  defaultRolePreference: RolePreference;
}

export interface OAuthConnections {
  google: boolean;
  github: boolean;
}

const THEME_STORAGE_KEY = 'me-theme';

function isTheme(theme: unknown): theme is UserPreferences['theme'] {
  return theme === 'light' || theme === 'dark';
}

function syncThemePreference(theme: UserPreferences['theme']) {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Ignore storage failures in constrained environments.
  }

  document.documentElement.dataset.theme = theme;
  window.dispatchEvent(new CustomEvent('me-theme-change', { detail: { theme } }));
}

export function useUserSettings() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [prefs, setPrefs] = useState<UserPreferences | null>(null);
  const [oauthConnections, setOAuthConnections] = useState<OAuthConnections | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      api.get<UserProfile>('/api/user/profile'),
      api.get<UserPreferences>('/api/user/preferences'),
      api.get<OAuthConnections>('/api/user/oauth-connections'),
    ])
      .then(([profileResult, prefsResult, oauthResult]) => {
        if (cancelled) return;
        setProfile(profileResult);
        setPrefs(prefsResult);
        setOAuthConnections(oauthResult);
        const density = prefsResult.dashboardDensity === 'dense' ? 'dense' : 'expansive';
        applyDashboardDensity(density);
      })
      .catch(() => {
        if (!cancelled) setError('Failed to load settings');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const saveProfile = useCallback(async (data: { fullName: string; bio: string }) => {
    await api.put('/api/user/profile', data);
    setProfile((current) => (current ? { ...current, ...data } : current));
  }, []);

  const savePreferences = useCallback(async (data: Partial<UserPreferences>) => {
    await api.put('/api/user/preferences', data);
    setPrefs((current) => (current ? { ...current, ...data } : current));

    if (isTheme(data.theme)) {
      syncThemePreference(data.theme);
    }
    if (data.dashboardDensity === 'dense' || data.dashboardDensity === 'expansive') {
      applyDashboardDensity(data.dashboardDensity);
    }
  }, []);

  const disconnectOAuth = useCallback(async (provider: 'google' | 'github') => {
    await api.delete(`/api/user/oauth-connections/${provider}`);
    setOAuthConnections((current) => (current ? { ...current, [provider]: false } : current));
  }, []);

  const deleteAccount = useCallback(async () => {
    await api.delete('/api/user/account');
    window.location.href = '/login';
  }, []);

  return {
    profile,
    prefs,
    oauthConnections,
    loading,
    error,
    saveProfile,
    savePreferences,
    disconnectOAuth,
    deleteAccount,
  };
}
