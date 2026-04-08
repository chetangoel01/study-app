import { Link } from 'react-router-dom';
import type { AuthUser } from '../types.js';

export function Layout({ user, children }: { user: AuthUser; children: React.ReactNode }) {
  return (
    <div className="layout">
      <nav className="topbar">
        <Link to="/" className="topbar-logo">Study Guide</Link>
        <span className="topbar-user">{user.email}</span>
      </nav>
      <main className="main-content">{children}</main>
    </div>
  );
}
