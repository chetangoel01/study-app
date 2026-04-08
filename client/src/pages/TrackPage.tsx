import { Link, useParams } from 'react-router-dom';
import { useCurriculum } from '../hooks/useCurriculum.js';
import { TRACK_BLURBS } from '../trackMeta.js';

export function TrackPage() {
  const { trackId } = useParams<{ trackId: string }>();
  const { data, loading, error } = useCurriculum();

  if (loading) return <div className="loading" role="status" aria-live="polite">Loading...</div>;
  if (error) return <div className="error" role="alert">{error}</div>;
  if (!data || !trackId) return null;

  const track = data.tracks.find((t) => t.id === trackId);
  const modules = data.modules.filter((m) => m.track === trackId);
  if (!track) return <div className="error" role="alert">Track not found.</div>;

  const MODULE_STATUS_LABELS: Record<string, string> = {
    done: 'Completed',
    'in-progress': 'In Progress',
    available: 'Unlocked',
    'soft-locked': 'Locked',
  };
  const done = modules.filter((m) => m.status === 'done').length;
  const pct = modules.length > 0 ? Math.round((done / modules.length) * 100) : 0;

  return (
    <div className="track-page" data-track={track.id}>
      <nav className="track-breadcrumb" aria-label="Breadcrumb">
        <Link to="/">Dashboard</Link>
        <span aria-hidden="true"> › </span>
        <span>{track.label}</span>
      </nav>

      <section className="track-hero surface-card" data-track={track.id}>
        <div className="track-page-header">
          <p className="panel-label">Track overview</p>
          <h1>{track.label}</h1>
          <p className="track-meta">{TRACK_BLURBS[track.id]}</p>
        </div>
        <div className="track-stat-grid">
          <div className="stat-card">
            <span className="stat-value">{done}/{modules.length}</span>
            <span className="stat-label">modules done</span>
          </div>
          <div className="stat-card">
            <span className="stat-value">{pct}%</span>
            <span className="stat-label">progress</span>
          </div>
        </div>
        <div className="track-progress-bar" style={{ marginTop: '1rem' }}>
          <div className="track-progress-fill" style={{ width: `${pct}%` }} />
        </div>
      </section>

      <div className="timeline" aria-label="Module roadmap">
        {modules.map((m, i) => {
          const side = i % 2 === 0 ? 'left' : 'right';
          const stepNum = i + 1;
          const isLocked = m.status === 'soft-locked';

          return (
            <div key={m.id} className={`timeline-row timeline-row-${side}`}>
              {side === 'right' && <div className="timeline-spacer" aria-hidden="true" />}
              <Link
                to={isLocked ? '#' : `/track/${track.id}/module/${m.id}`}
                className={`timeline-card surface-card status-${m.status}`}
                aria-disabled={isLocked}
                onClick={isLocked ? (event) => event.preventDefault() : undefined}
              >
                <div className="timeline-card-status">
                  <span className={`status-chip status-${m.status}`}>
                    {MODULE_STATUS_LABELS[m.status]}
                  </span>
                  {m.status === 'done' && (
                    <span className="timeline-check" aria-hidden="true">✓</span>
                  )}
                  {isLocked && (
                    <span className="timeline-lock" aria-hidden="true">🔒</span>
                  )}
                </div>
                <h3 className="timeline-card-title">{m.title}</h3>
                <p className="timeline-card-summary">{m.summary}</p>
                {m.status === 'in-progress' && (
                  <span className="timeline-cta">Continue Session →</span>
                )}
              </Link>
              <div className="timeline-spine" aria-hidden="true">
                <div className={`timeline-node node-${m.status}`}>{stepNum}</div>
                {i < modules.length - 1 && <div className="timeline-line" />}
              </div>
              {side === 'left' && <div className="timeline-spacer" aria-hidden="true" />}
            </div>
          );
        })}
      </div>

      <section className="track-refresher surface-card">
        <h2>Need a refresher?</h2>
        <p className="page-muted">
          Review completed modules to keep your memory sharp.
          Spaced repetition is key to long-term mastery.
        </p>
        <div className="track-refresher-actions">
          <button type="button" className="primary-action">Review Past Modules</button>
          <button type="button" className="secondary-link">View Statistics</button>
        </div>
      </section>
    </div>
  );
}
