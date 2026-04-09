import { useEffect, useMemo, useRef, useState } from 'react';
import { NavLink, useParams } from 'react-router-dom';
import { api } from '../api/client.js';
import { useUserSettings } from '../hooks/useUserSettings.js';

type NotificationKey = 'notifyDailyChallenge' | 'notifyWeeklyProgress' | 'notifyCommunity';

const NOTIFICATION_OPTIONS: { key: NotificationKey; label: string }[] = [
  { key: 'notifyDailyChallenge', label: 'Daily Challenge Reminders' },
  { key: 'notifyWeeklyProgress', label: 'Weekly Progress Reports' },
  { key: 'notifyCommunity', label: 'Community Activity' },
];

const SETTINGS_SECTIONS = [
  { id: 'profile', label: 'Profile', description: 'Personal details and bio' },
  { id: 'security', label: 'Security', description: 'Password and account access' },
  { id: 'preferences', label: 'Preferences', description: 'Theme and notifications' },
  { id: 'connections', label: 'Connections', description: 'Google and GitHub' },
  { id: 'danger', label: 'Danger Zone', description: 'Account deletion controls' },
] as const;

export function SettingsPage() {
  const { section } = useParams<{ section?: string }>();
  const {
    profile,
    prefs,
    oauthConnections,
    loading,
    error,
    saveProfile,
    savePreferences,
    disconnectOAuth,
    deleteAccount,
  } = useUserSettings();

  const [fullName, setFullName] = useState('');
  const [bio, setBio] = useState('');
  const [profileSaved, setProfileSaved] = useState(false);
  const [profileError, setProfileError] = useState('');

  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState(false);

  const [settingsError, setSettingsError] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const profileRef = useRef<HTMLElement>(null);
  const securityRef = useRef<HTMLElement>(null);
  const prefsRef = useRef<HTMLElement>(null);
  const oauthRef = useRef<HTMLElement>(null);
  const dangerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!profile) return;
    setFullName(profile.fullName);
    setBio(profile.bio);
  }, [profile]);

  useEffect(() => {
    if (!section) return;

    const targets: Record<string, HTMLElement | null> = {
      profile: profileRef.current,
      security: securityRef.current,
      preferences: prefsRef.current,
      connections: oauthRef.current,
      danger: dangerRef.current,
    };

    targets[section]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [section, loading]);

  const sectionError = useMemo(() => settingsError || profileError || pwError, [settingsError, profileError, pwError]);

  const handleSaveProfile = async (event: React.FormEvent) => {
    event.preventDefault();
    setProfileError('');
    try {
      await saveProfile({ fullName, bio });
      setProfileSaved(true);
      window.setTimeout(() => setProfileSaved(false), 2000);
    } catch {
      setProfileError('Unable to save your profile right now.');
    }
  };

  const handleChangePassword = async (event: React.FormEvent) => {
    event.preventDefault();
    setPwError('');
    setPwSuccess(false);

    if (newPw !== confirmPw) {
      setPwError('Passwords do not match.');
      return;
    }
    if (newPw.length < 8) {
      setPwError('Password must be at least 8 characters.');
      return;
    }

    try {
      await api.post('/api/auth/change-password', {
        currentPassword: currentPw,
        newPassword: newPw,
      });
      setPwSuccess(true);
      setCurrentPw('');
      setNewPw('');
      setConfirmPw('');
    } catch {
      setPwError('Current password is incorrect.');
    }
  };

  const handleThemeChange = async (theme: 'light' | 'dark') => {
    setSettingsError('');
    try {
      await savePreferences({ theme });
    } catch {
      setSettingsError('Unable to save your preferences right now.');
    }
  };

  const handleDashboardDensity = async (dashboardDensity: 'dense' | 'expansive') => {
    setSettingsError('');
    try {
      await savePreferences({ dashboardDensity });
    } catch {
      setSettingsError('Unable to save your preferences right now.');
    }
  };

  const handleTogglePreference = async (key: NotificationKey) => {
    if (!prefs) return;
    setSettingsError('');
    try {
      await savePreferences({ [key]: !prefs[key] } as Record<NotificationKey, boolean>);
    } catch {
      setSettingsError('Unable to save your preferences right now.');
    }
  };

  const handleDisconnect = async (provider: 'google' | 'github') => {
    setSettingsError('');
    try {
      await disconnectOAuth(provider);
    } catch (disconnectError) {
      const message = disconnectError instanceof Error
        ? disconnectError.message
        : 'Unable to disconnect that account right now.';
      setSettingsError(message);
    }
  };

  const handleDeleteAccount = async () => {
    setSettingsError('');
    try {
      await deleteAccount();
    } catch {
      setSettingsError('Unable to delete your account right now.');
    }
  };

  if (loading) return <div className="loading" role="status" aria-live="polite">Loading settings...</div>;
  if (error) return <div className="error" role="alert">{error}</div>;

  return (
    <div className="settings-shell">
      <aside className="settings-sidebar surface-card">
        <div className="settings-sidebar-header">
          <p className="panel-label">Workspace</p>
          <h1>Settings</h1>
          <p className="page-muted">
            Manage your account preferences, security settings, and connected applications.
          </p>
        </div>
        <nav className="settings-nav" aria-label="Settings sections">
          {SETTINGS_SECTIONS.map((entry) => (
            <NavLink
              key={entry.id}
              to={`/settings/${entry.id}`}
              className={({ isActive }) => `settings-nav-link${isActive || (!section && entry.id === 'profile') ? ' active' : ''}`}
            >
              <span className="settings-nav-label">{entry.label}</span>
              <span className="settings-nav-copy">{entry.description}</span>
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="settings-page">
        {sectionError ? <div className="error" role="alert">{sectionError}</div> : null}

        <section ref={profileRef} className="settings-section surface-card" aria-labelledby="profile-heading">
          <div className="settings-section-header">
            <div>
              <h2 id="profile-heading">Profile Information</h2>
              <p className="page-muted">Update your personal details and keep your study identity current.</p>
            </div>
          </div>
          <form onSubmit={handleSaveProfile} className="settings-form">
            <div className="settings-field-row">
              <div>
                <label className="field-label" htmlFor="settings-name">Full Name</label>
                <input
                  id="settings-name"
                  type="text"
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  maxLength={100}
                />
              </div>
              <div>
                <label className="field-label" htmlFor="settings-email">Email Address</label>
                <input id="settings-email" type="email" value={profile?.email ?? ''} disabled />
              </div>
            </div>
            <label className="field-label" htmlFor="settings-bio">Bio</label>
            <textarea
              id="settings-bio"
              value={bio}
              onChange={(event) => setBio(event.target.value)}
              rows={3}
              maxLength={500}
            />
            <button type="submit" className="primary-action settings-save-btn">
              {profileSaved ? 'Saved ✓' : 'Save Profile'}
            </button>
          </form>
        </section>

        <section ref={securityRef} className="settings-section surface-card" aria-labelledby="security-heading">
          <h2 id="security-heading">Security</h2>
          <form onSubmit={handleChangePassword} className="settings-form">
            <label className="field-label" htmlFor="current-pw">Current Password</label>
            <input
              id="current-pw"
              type="password"
              value={currentPw}
              onChange={(event) => setCurrentPw(event.target.value)}
              autoComplete="current-password"
            />
            <div className="settings-field-row">
              <div>
                <label className="field-label" htmlFor="new-pw">New Password</label>
                <input
                  id="new-pw"
                  type="password"
                  value={newPw}
                  onChange={(event) => setNewPw(event.target.value)}
                  autoComplete="new-password"
                />
              </div>
              <div>
                <label className="field-label" htmlFor="confirm-pw">Confirm New Password</label>
                <input
                  id="confirm-pw"
                  type="password"
                  value={confirmPw}
                  onChange={(event) => setConfirmPw(event.target.value)}
                  autoComplete="new-password"
                />
              </div>
            </div>
            {pwSuccess ? <p className="save-badge" role="status">Password updated successfully.</p> : null}
            <button type="submit" className="primary-action settings-save-btn">
              Update Password
            </button>
          </form>
        </section>

        <section ref={prefsRef} className="settings-section surface-card" aria-labelledby="prefs-heading">
          <h2 id="prefs-heading">Preferences</h2>
          <div className="settings-pref-row">
            <div>
              <strong>System Theme</strong>
              <p className="page-muted settings-pref-copy">Switch between light and dark modes</p>
            </div>
            <div className="theme-toggle">
              <button
                type="button"
                className={`theme-pill${prefs?.theme === 'light' ? ' active' : ''}`}
                onClick={() => handleThemeChange('light')}
              >
                Light
              </button>
              <button
                type="button"
                className={`theme-pill${prefs?.theme === 'dark' ? ' active' : ''}`}
                onClick={() => handleThemeChange('dark')}
              >
                Dark
              </button>
            </div>
          </div>
          <div className="settings-pref-row">
            <div>
              <strong>Dashboard layout</strong>
              <p className="page-muted settings-pref-copy">
                Compact fits more on screen; comfortable uses more spacing and larger cards.
              </p>
            </div>
            <div className="theme-toggle">
              <button
                type="button"
                className={`theme-pill${(prefs?.dashboardDensity ?? 'expansive') === 'dense' ? ' active' : ''}`}
                onClick={() => handleDashboardDensity('dense')}
              >
                Compact
              </button>
              <button
                type="button"
                className={`theme-pill${(prefs?.dashboardDensity ?? 'expansive') === 'expansive' ? ' active' : ''}`}
                onClick={() => handleDashboardDensity('expansive')}
              >
                Comfortable
              </button>
            </div>
          </div>
          {NOTIFICATION_OPTIONS.map(({ key, label }) => (
            <div key={key} className="settings-pref-row">
              <span>{label}</span>
              <button
                type="button"
                role="switch"
                aria-checked={Boolean(prefs?.[key as NotificationKey])}
                aria-label={label}
                className={`toggle-switch${prefs?.[key as NotificationKey] ? ' on' : ''}`}
                onClick={() => handleTogglePreference(key as NotificationKey)}
              />
            </div>
          ))}

          <h3 style={{ marginTop: '24px', marginBottom: '16px' }}>Practice Community</h3>
          <div className="settings-pref-row">
            <div>
              <strong>Available for peer Mock Interviews</strong>
              <p className="page-muted settings-pref-copy">Allow other users to request to schedule mock interviews with you.</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={Boolean(prefs?.allowMockInterviews)}
              aria-label="Available for Mock Interviews"
              className={`toggle-switch${prefs?.allowMockInterviews ? ' on' : ''}`}
              onClick={async () => {
                if (!prefs) return;
                setSettingsError('');
                try {
                  await savePreferences({ allowMockInterviews: !prefs.allowMockInterviews });
                } catch {
                  setSettingsError('Unable to save your preferences right now.');
                }
              }}
            />
          </div>
        </section>

        <section ref={oauthRef} className="settings-section surface-card" aria-labelledby="oauth-heading">
          <h2 id="oauth-heading">Connected Accounts</h2>
          {(['google', 'github'] as const).map((provider) => (
            <div key={provider} className="oauth-connection-row">
              <div className="oauth-connection-info">
                <span className="oauth-provider-label">
                  {provider.charAt(0).toUpperCase() + provider.slice(1)}
                </span>
                <span className="page-muted settings-pref-copy">
                  {oauthConnections?.[provider] ? 'Connected' : 'Not connected'}
                </span>
              </div>
              {oauthConnections?.[provider] ? (
                <button type="button" className="secondary-link" onClick={() => handleDisconnect(provider)}>
                  Disconnect
                </button>
              ) : (
                <a href={`/api/auth/oauth/${provider}`} className="secondary-link">
                  Connect
                </a>
              )}
            </div>
          ))}
        </section>

        <section
          ref={dangerRef}
          className="settings-section settings-danger surface-card"
          aria-labelledby="danger-heading"
        >
          <h2 id="danger-heading" className="settings-danger-title">Danger Zone</h2>
          <p className="page-muted">
            Once you delete your account, there is no going back. Please be certain.
          </p>
          {!deleteConfirm ? (
            <button type="button" className="danger-btn" onClick={() => setDeleteConfirm(true)}>
              Delete Account
            </button>
          ) : (
            <div className="danger-confirm">
              <p><strong>Are you absolutely sure?</strong> This cannot be undone.</p>
              <div className="danger-confirm-actions">
                <button type="button" className="danger-btn" onClick={handleDeleteAccount}>
                  Yes, Delete My Account
                </button>
                <button type="button" className="secondary-link" onClick={() => setDeleteConfirm(false)}>
                  Cancel
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
