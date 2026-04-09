import { Link, useParams } from 'react-router-dom';
import { useCurriculum } from '../hooks/useCurriculum.js';
import { TRACK_TOPIC_ELABORATION, TRACK_TOPIC_PRIMARY } from '../trackMeta.js';
import type { CurriculumModule } from '../types.js';

type ModuleStep = {
  module: CurriculumModule;
  stepNum: number;
  side: 'left' | 'right';
  isLocked: boolean;
  displayStatus: string;
};

function getModuleActionLabel(module: CurriculumModule, locked: boolean): string {
  if (locked) return 'Finish recommended modules first';
  if (module.status === 'done') return 'Review module';
  if (module.status === 'in-progress') return 'Continue session';
  return 'Start module';
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

  const moduleSteps: ModuleStep[] = modules.map((m, i) => {
    const isLocked = m.status !== 'done' && (m.blockedBy ?? []).some((moduleId) => {
      const prereq = modules.find((candidate) => candidate.id === moduleId);
      return Boolean(prereq && prereq.status !== 'done');
    });
    const displayStatus = isLocked ? 'locked' : m.status;
    return {
      module: m,
      stepNum: i + 1,
      side: i % 2 === 0 ? 'left' : 'right',
      isLocked,
      displayStatus,
    };
  });

  return (
    <div className="track-page" data-track={track.id}>
      <nav className="page-breadcrumb" aria-label="Breadcrumb">
        <Link to="/curriculum">Curriculum</Link>
        <span className="material-symbols-outlined page-breadcrumb-chevron" aria-hidden="true">chevron_right</span>
        <span className="page-breadcrumb-current">{track.label}</span>
      </nav>

      <header className="track-overview">
        <h1 className="track-page-title">{track.label}</h1>
        <p className="track-page-description">{TRACK_TOPIC_PRIMARY[track.id]}</p>
        <div className="track-overview-stats-row" aria-label="Track progress">
          <div className="track-overview-stats">
            <span className="material-symbols-outlined track-overview-stats-icon" aria-hidden="true">
              donut_large
            </span>
            <span className="track-overview-stats-text">
              <span className="track-overview-stat-value">{done}</span>
              <span className="track-overview-stat-suffix">
                {' '}
                of
                {' '}
                {modules.length}
                {' '}
                modules
              </span>
              <span className="track-overview-stat-sep" aria-hidden="true">·</span>
              <span className="track-overview-stat-value">{pct}%</span>
              <span className="track-overview-stat-suffix"> done</span>
            </span>
          </div>
        </div>
        <p className="track-overview-elaboration">{TRACK_TOPIC_ELABORATION[track.id]}</p>
      </header>

      <div className="timeline" aria-label="Module roadmap">
        {moduleSteps.map(({ module: m, side, stepNum, isLocked, displayStatus }) => {
          const blockerTitles = (m.blockedBy ?? [])
            .map((moduleId) => moduleTitleById.get(moduleId) ?? moduleId)
            .join(', ');
          const actionLabel = getModuleActionLabel(m, isLocked);
          const actionClass = isLocked
            ? 'timeline-cta timeline-cta--muted'
            : m.status === 'done'
              ? 'timeline-cta timeline-cta--secondary'
              : 'timeline-cta';

          return (
            <div key={m.id} className={`timeline-row timeline-row-${side}`}>
              <Link
                to={`/track/${track.id}/module/${m.id}`}
                className={`timeline-card surface-card status-${displayStatus}`}
                aria-disabled={isLocked ? 'true' : undefined}
                tabIndex={isLocked ? -1 : undefined}
                onClick={isLocked ? (event) => event.preventDefault() : undefined}
              >
                {(displayStatus !== 'in-progress' || m.status === 'done') && (
                  <div className="timeline-card-status">
                    {displayStatus !== 'in-progress' && (
                      <span className={`status-chip status-${displayStatus}`}>
                        {MODULE_STATUS_LABELS[displayStatus]}
                      </span>
                    )}
                    {m.status === 'done' && (
                      <span className="timeline-check" aria-hidden="true">✓</span>
                    )}
                  </div>
                )}
                <h3 className="timeline-card-title">{m.title}</h3>
                <p className="timeline-card-summary">{m.summary}</p>
                {blockerTitles ? (
                  <p className="timeline-card-advisory">Recommended first: {blockerTitles}</p>
                ) : null}
                <span className={actionClass}>
                  <span>{actionLabel}</span>
                  {!isLocked && (
                    <span className="material-symbols-outlined" aria-hidden="true">arrow_forward</span>
                  )}
                </span>
              </Link>
              <div className="timeline-spine" aria-hidden="true">
                <div className={`timeline-node node-${displayStatus}`}>{stepNum}</div>
              </div>
              <div className="timeline-spacer" aria-hidden="true" />
            </div>
          );
        })}
      </div>
    </div>
  );
}
