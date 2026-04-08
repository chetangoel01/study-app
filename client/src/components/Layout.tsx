import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import type { AuthUser } from '../types.js';
import { AccountMenu } from './AccountMenu.js';
import { SearchOverlay } from './SearchOverlay.js';

export function Layout({ user, children }: { user: AuthUser; children: React.ReactNode }) {
  const location = useLocation();
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    setSearchOpen(false);
  }, [location.pathname]);

  const curriculumActive = location.pathname.startsWith('/track/');

  return (
    <div className="layout">
      <div className="layout-orb layout-orb-left" aria-hidden="true" />
      <div className="layout-orb layout-orb-right" aria-hidden="true" />
      <nav className="topbar" aria-label="Main navigation">
        <Link to="/" className="topbar-logo">
          <span className="topbar-mark">ME</span>
          <span className="topbar-brand">
            <span className="topbar-title">Mindful Engineer</span>
            <span className="topbar-tagline">Deep work. Steady progress.</span>
          </span>
        </Link>

        <div className="topbar-nav" role="list">
          <NavLink
            to="/"
            end
            className={({ isActive }) => `topbar-link${isActive ? ' active' : ''}`}
          >
            Dashboard
          </NavLink>
          <Link
            to="/track/dsa-leetcode"
            className={`topbar-link${curriculumActive ? ' active' : ''}`}
          >
            Curriculum
          </Link>
          <NavLink
            to="/practice"
            className={({ isActive }) => `topbar-link${isActive ? ' active' : ''}`}
          >
            Practice
          </NavLink>
          <NavLink
            to="/community"
            className={({ isActive }) => `topbar-link${isActive ? ' active' : ''}`}
          >
            Community
          </NavLink>
        </div>

        <div className="topbar-actions">
          <button
            type="button"
            className="topbar-icon-btn"
            aria-label="Search"
            onClick={() => setSearchOpen(true)}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </button>
          <button type="button" className="topbar-icon-btn" aria-label="Help">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </button>
          <AccountMenu user={user} />
        </div>
      </nav>
      <main className="main-content">{children}</main>
      {searchOpen && <SearchOverlay onClose={() => setSearchOpen(false)} />}
    </div>
  );
}
