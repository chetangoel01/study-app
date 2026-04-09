import { Link, useParams } from 'react-router-dom';
import { useCurriculum } from '../hooks/useCurriculum.js';
import { TRACK_BLURBS } from '../trackMeta.js';
import type { CurriculumModule } from '../types.js';

function pickMostRecentCompletedModule(modules: CurriculumModule[]): CurriculumModule | null {
  const completedModules = modules.filter((module) => module.status === 'done');
  if (completedModules.length === 0) {
    return null;
  }

  const timestampedModules = completedModules.filter((module) => module.latest_progress_updated_at);
  if (timestampedModules.length > 0) {
    return [...timestampedModules].sort((a, b) => {
      const aUpdatedAt = a.latest_progress_updated_at ?? '';
      const bUpdatedAt = b.latest_progress_updated_at ?? '';
      const timestampComparison = bUpdatedAt.localeCompare(aUpdatedAt);
      if (timestampComparison !== 0) {
        return timestampComparison;
      }

      return modules.indexOf(a) - modules.indexOf(b);
    })[0];
  }

  for (let index = modules.length - 1; index >= 0; index -= 1) {
    if (modules[index].status === 'done') {
      return modules[index];
    }
  }

  return null;
}

export function TrackPage() {
  const { trackId } = useParams<{ trackId: string }>();
  const { data, loading, error } = useCurriculum();

  if (loading) return <div className="loading" role="status" aria-live="polite">Loading...</div>;
  if (error) return <div className="error" role="alert">{error}</div>;
  if (!data || !trackId) return null;

  const track = data.tracks.find((t) => t.id === trackId);
  const modules = data.modules.filter((m) => m.track === trackId);
  const moduleTitleById = new Map(data.modules.map((module) => [module.id, module.title]));
  if (!track) return <div className="error" role="alert">Track not found.</div>;

  const MODULE_STATUS_LABELS: Record<string, string> = {
    done: 'Completed',
    'in-progress': 'In Progress',
    available: 'Unlocked',
    locked: 'Locked',
  };
  const done = modules.filter((m) => m.status === 'done').length;
  const pct = modules.length > 0 ? Math.round((done / modules.length) * 100) : 0;
  const reviewTarget = pickMostRecentCompletedModule(modules);

  return (
    <div className="track-page" data-track={track.id}>
      <nav className="page-breadcrumb" aria-label="Breadcrumb">
        <Link to="/curriculum">Curriculum</Link>
        <span className="material-symbols-outlined page-breadcrumb-chevron" aria-hidden="true">chevron_right</span>
        <span className="page-breadcrumb-current">{track.label}</span>
      </nav>

      <header className="track-page-header-stitch">
        <div className="track-page-header-main">
          <h1 className="track-page-title-stitch">
            {track.label}
          </h1>
          <p className="track-meta track-meta-stitch">{TRACK_BLURBS[track.id]}</p>
        </div>
        <div className="track-summary-pill">
          <div className="track-summary-cell">
            <span className="track-summary-val">{done}/{modules.length}</span>
            <span className="track-summary-lbl">Modules done</span>
          </div>
          <div className="track-summary-divider" aria-hidden="true" />
          <div className="track-summary-cell">
            <span className="track-summary-val">{pct}%</span>
            <span className="track-summary-lbl">Progress</span>
          </div>
        </div>
      </header>
      <div className="track-hero-progress-wide">
        <div className="track-hero-progress-wide-fill" style={{ width: `${pct}%` }} />
      </div>

      <div className="timeline" aria-label="Module roadmap">
        {modules.map((m, i) => {
          const side = i % 2 === 0 ? 'left' : 'right';
          const stepNum = i + 1;
          const isLocked = m.status !== 'done' && (m.blockedBy ?? []).some((moduleId) => {
            const prereq = modules.find((candidate) => candidate.id === moduleId);
            return Boolean(prereq && prereq.status !== 'done');
          });
          const displayStatus = isLocked ? 'locked' : m.status;
          const blockerTitles = (m.blockedBy ?? [])
            .map((moduleId) => moduleTitleById.get(moduleId) ?? moduleId)
            .join(', ');

          return (
            <div key={m.id} className={`timeline-row timeline-row-${side}`}>
              {side === 'right' && <div className="timeline-spacer" aria-hidden="true" />}
              <Link
                to={`/track/${track.id}/module/${m.id}`}
                className={`timeline-card surface-card status-${displayStatus}`}
                aria-disabled={isLocked ? 'true' : undefined}
                tabIndex={isLocked ? -1 : undefined}
                onClick={isLocked ? (event) => event.preventDefault() : undefined}
              >
                <div className="timeline-card-status">
                  <span className={`status-chip status-${displayStatus}`}>
                    {MODULE_STATUS_LABELS[displayStatus]}
                  </span>
                  {m.status === 'done' && (
                    <span className="timeline-check" aria-hidden="true">✓</span>
                  )}
                </div>
                <h3 className="timeline-card-title">{m.title}</h3>
                <p className="timeline-card-summary">{m.summary}</p>
                {blockerTitles ? (
                  <p className="timeline-card-advisory">Recommended first: {blockerTitles}</p>
                ) : null}
                {m.status === 'in-progress' && !isLocked && (
                  <span className="timeline-cta">Continue Session →</span>
                )}
              </Link>
              <div className="timeline-spine" aria-hidden="true">
                <div className={`timeline-node node-${displayStatus}`}>{stepNum}</div>
                {i < modules.length - 1 && <div className="timeline-line" />}
              </div>
              {side === 'left' && <div className="timeline-spacer" aria-hidden="true" />}
            </div>
          );
        })}
      </div>

      <section className="track-refresher track-refresher-stitch">
        <div className="track-refresher-stitch-glow track-refresher-stitch-glow--tr" aria-hidden="true" />
        <div className="track-refresher-stitch-glow track-refresher-stitch-glow--bl" aria-hidden="true" />
        <div className="track-refresher-stitch-inner">
          <h2>Need a refresher?</h2>
          <p className="track-refresher-sub">
            Review completed modules to keep your memory sharp.
            Spaced repetition is key to long-term mastery.
          </p>
          <div className="track-refresher-actions">
            {reviewTarget ? (
              <Link
                to={`/track/${track.id}/module/${reviewTarget.id}`}
                className="track-refresher-primary"
              >
                Review past modules
              </Link>
            ) : null}
            <Link to="/" className="track-refresher-secondary">View statistics</Link>
          </div>
        </div>
      </section>
    </div>
  );
}
