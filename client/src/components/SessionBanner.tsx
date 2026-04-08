import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

export function SessionBanner() {
  const [expired, setExpired] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const handler = () => setExpired(true);
    window.addEventListener('session-expired', handler);
    return () => window.removeEventListener('session-expired', handler);
  }, []);

  if (!expired) return null;

  return (
    <div className="session-banner" role="alert" aria-live="assertive">
      <span>Your session timed out.</span>{' '}
      <button
        type="button"
        onClick={() => navigate(`/login?next=${encodeURIComponent(location.pathname)}`)}
      >
        log back in
      </button>
    </div>
  );
}
