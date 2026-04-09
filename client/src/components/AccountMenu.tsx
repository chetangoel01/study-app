import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import type { AuthUser } from '../types.js';

export function AccountMenu({ user }: { user: AuthUser }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return undefined;

    const handlePointerDown = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const handleLogout = async () => {
    try {
      await api.post<{ ok: boolean }>('/api/auth/logout');
    } catch {
      // Best effort logout; client redirect still clears the authenticated shell.
    }
    window.location.href = '/login';
  };

  return (
    <div className="account-menu-wrap" ref={ref}>
      <button
        type="button"
        className="topbar-avatar-btn-real"
        aria-haspopup="true"
        aria-expanded={open}
        aria-label="Account menu"
        onClick={() => setOpen((value) => !value)}
      >
        <span aria-hidden="true">{user.email.slice(0, 1).toUpperCase()}</span>
      </button>

      {open && (
        <div className="account-menu" role="menu" aria-label="Account options">
          <div className="account-menu-header">
            <span className="account-menu-name">{user.email}</span>
            <span className="account-menu-role">Member</span>
          </div>
          <hr className="account-menu-divider" aria-hidden="true" />
          <Link
            to="/settings/profile"
            className="account-menu-item"
            role="menuitem"
            onClick={() => setOpen(false)}
          >
            My Profile
          </Link>
          <Link
            to="/settings/preferences"
            className="account-menu-item"
            role="menuitem"
            onClick={() => setOpen(false)}
          >
            Settings
          </Link>
          <Link
            to="/settings/security"
            className="account-menu-item"
            role="menuitem"
            onClick={() => setOpen(false)}
          >
            Change Password
          </Link>
          <hr className="account-menu-divider" aria-hidden="true" />
          <button type="button" className="account-menu-item account-menu-logout" role="menuitem" onClick={handleLogout}>
            Logout
          </button>
        </div>
      )}
    </div>
  );
}
