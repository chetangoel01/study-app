import { Link } from 'react-router-dom';
import { useCurriculum } from '../hooks/useCurriculum.js';
import { useProgress } from '../hooks/useProgress.js';
import { TrackColumn } from '../components/TrackColumn.js';
import type { CurriculumModule } from '../types.js';
import { TRACK_BLURBS } from '../trackMeta.js';

// Per spec: most recently touched in-progress module; fallback to first available in dsa-leetcode
function pickFocus(modules: CurriculumModule[]): CurriculumModule | null {
  const inProgress = modules.filter((m) => m.status === 'in-progress');
  if (inProgress.length > 0) {
    return inProgress.sort((a, b) => {
      const ta = a.latest_progress_updated_at ?? '';
      const tb = b.latest_progress_updated_at ?? '';
      return tb.localeCompare(ta); // descending — most recent first
    })[0];
  }
  return modules.find((m) => m.track === 'dsa-leetcode' && m.status === 'available') ?? null;
}

export function DashboardPage() {
  const { data, loading, error } = useCurriculum();
  const { isCompleted } = useProgress();

  if (loading) return <div className="loading" role="status" aria-live="polite">Loading curriculum...</div>;
  if (error) return <div className="error" role="alert">Error: {error}</div>;
  if (!data) return null;

  const { tracks, modules } = data;
  const focus = pickFocus(modules);
  const focusTrack = focus ? tracks.find((track) => track.id === focus.track) : null;
  const completedModules = modules.filter((module) => module.status === 'done').length;
  const inProgressModules = modules.filter((module) => module.status === 'in-progress').length;
  const unlockedModules = modules.filter((module) => module.status !== 'soft-locked').length;
  const overallPct = modules.length > 0 ? Math.round((completedModules / modules.length) * 100) : 0;

  // Find the next unchecked item for the focus module (spec: "next unchecked item" shown in card)
  const nextItem = focus?.items.find((item) => !isCompleted(focus.id, item.id)) ?? null;

  return (
    <div className="dashboard">
      <section className="dashboard-hero surface-card">
        <div className="dashboard-intro">
          <p className="eyebrow">Structured interview prep</p>
          <h1 className="dashboard-title">A study plan that does not feel like punishment.</h1>
          <p className="dashboard-copy">
            Keep every lane visible, make the next step obvious, and move without recreating your plan from scratch.
          </p>
          <div className="dashboard-stat-grid">
            <div className="stat-card">
              <span className="stat-value">{overallPct}%</span>
              <span className="stat-label">roadmap complete</span>
            </div>
            <div className="stat-card">
              <span className="stat-value">{inProgressModules}</span>
              <span className="stat-label">modules in motion</span>
            </div>
            <div className="stat-card">
              <span className="stat-value">{unlockedModules}</span>
              <span className="stat-label">modules unlocked</span>
            </div>
          </div>
        </div>

        {focus ? (
          <div className="focus-panel surface-subcard" data-track={focus.track}>
            <div className="focus-pill-row">
              <span className="focus-pill">Up next</span>
              <span className="focus-track-label">{focusTrack?.label ?? focus.track}</span>
            </div>
            <h2>{focus.title}</h2>
            <p className="focus-summary">{focus.summary || TRACK_BLURBS[focus.track]}</p>
            <div className="focus-meta-grid">
              <span>{focus.estimate}</span>
              <span>{focus.sessions} sessions</span>
              <span>{focus.completedItems}/{focus.totalItems} items done</span>
            </div>
            {nextItem && (
              <p className="focus-next-item">
                <span className="focus-next-label">Next item</span>
                {nextItem.url
                  ? <a href={nextItem.url} target="_blank" rel="noreferrer">{nextItem.label}</a>
                  : <span>{nextItem.label}</span>}
              </p>
            )}
            <div className="focus-actions">
              <Link to={`/track/${focus.track}/module/${focus.id}`} className="primary-action">
                {focus.status === 'available' ? 'Start module' : 'Resume module'}
              </Link>
              <Link to={`/track/${focus.track}`} className="secondary-link">Browse track</Link>
            </div>
          </div>
        ) : (
          <div className="focus-panel surface-subcard dashboard-empty">
            <p className="focus-pill">Ready to start</p>
            <h2>Pick a lane and get moving.</h2>
            <p className="focus-summary">
              Start with foundations, then build outward into system design, ML, and behavioral polish.
            </p>
          </div>
        )}
      </section>

      <div className="dashboard-section-header">
        <div>
          <p className="panel-label">Tracks</p>
          <h2>Your study lanes</h2>
        </div>
        <p className="dashboard-section-copy">
          Each track now has a clearer signal, stronger visual hierarchy, and a less chaotic preview.
        </p>
      </div>

      <div className="track-grid">
        {tracks.map((track) => (
          <TrackColumn key={track.id} track={track}
            modules={modules.filter((m) => m.track === track.id)} />
        ))}
      </div>
    </div>
  );
}
