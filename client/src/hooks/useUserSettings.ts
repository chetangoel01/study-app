import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client.js';

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
}

export interface OAuthConnections {
  google: boolean;
  github: boolean;
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
