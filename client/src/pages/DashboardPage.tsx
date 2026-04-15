import { Link, useOutletContext } from 'react-router-dom';
import { useCurriculum } from '../hooks/useCurriculum.js';
import { useProgress } from '../hooks/useProgress.js';
import { TrackColumn } from '../components/TrackColumn.js';
import type { AppOutletContext } from '../outletContext.js';
import type { CurriculumModule } from '../types.js';
import { greetingName } from '../lib/greetingName.js';

function getFocusRecencyTimestamp(module: CurriculumModule): number {
  const parsed = Date.parse(module.latest_progress_updated_at ?? '');
  if (!Number.isFinite(parsed)) return 0;
  return parsed;
}

function getModuleProgressSnapshot(module: CurriculumModule): {
  total: number;
  done: number;
  pct: number;
  hasProgress: boolean;
  isComplete: boolean;
} {
  const total = Math.max(0, (module.totalItems ?? 0) + (module.guideStepsTotal ?? 0));
  const doneRaw = (module.completedItems ?? 0) + (module.guideStepsCompleted ?? 0);
  const done = Math.max(0, Math.min(total, doneRaw));
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const hasProgress = done > 0 || Boolean(module.latest_progress_updated_at);
  const isComplete = module.status === 'done' || (total > 0 && done >= total);
  return { total, done, pct, hasProgress, isComplete };
}

function pickMostRecent(modules: CurriculumModule[]): CurriculumModule | null {
  if (modules.length === 0) return null;
  return [...modules].sort((a, b) => {
    const recencyDelta = getFocusRecencyTimestamp(b) - getFocusRecencyTimestamp(a);
    if (recencyDelta !== 0) return recencyDelta;
    const progressDelta = getModuleProgressSnapshot(b).done - getModuleProgressSnapshot(a).done;
    if (progressDelta !== 0) return progressDelta;
    return a.title.localeCompare(b.title);
  })[0] ?? null;
}

function pickFocus(modules: CurriculumModule[]): CurriculumModule | null {
  const inProgress = pickMostRecent(modules.filter((m) => m.status === 'in-progress'));
  if (inProgress) return inProgress;

  const availableModules = modules.filter((m) => m.status === 'available');
  const resumableAvailable = pickMostRecent(
    availableModules.filter((module) => getModuleProgressSnapshot(module).hasProgress),
  );
  if (resumableAvailable) return resumableAvailable;

  if (availableModules.length > 0) {
    // Respect server ordering for "next available" when no active progress exists.
    return availableModules[0];
  }

  return pickMostRecent(modules.filter((m) => m.status === 'done'));
}

function getPrimaryActionLabel(module: CurriculumModule): string {
  const snapshot = getModuleProgressSnapshot(module);
  if (snapshot.isComplete) return 'Review module';
  if (snapshot.hasProgress || module.status === 'in-progress') return 'Resume session';
  return 'Start session';
}

function getNextGuideStep(module: CurriculumModule): number | null {
  const total = Math.max(0, module.guideStepsTotal ?? 0);
  const completed = Math.max(0, Math.min(total, module.guideStepsCompleted ?? 0));
  if (completed >= total || total === 0) return null;
  return completed + 1;
}

function formatRelative(iso: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '';
  const diff = Date.now() - t;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  return `${days} days ago`;
}

export function DashboardPage() {
  const { user } = useOutletContext<AppOutletContext>();
  const { data, loading, error } = useCurriculum();
  const { isCompleted } = useProgress();

  if (loading) return <div className="loading" role="status" aria-live="polite">Loading curriculum...</div>;
  if (error) return <div className="error" role="alert">Error: {error}</div>;
  if (!data) return null;

  const { tracks, modules } = data;
  const focus = pickFocus(modules);
  const focusTrack = focus ? tracks.find((track) => track.id === focus.track) : null;
  const inProgressModules = modules.filter((module) => module.status === 'in-progress').length;
  const publishedModules = modules.length;
  const fractionalDone = modules.reduce((sum, m) => {
    if (m.status === 'done') return sum + 1;
    const total = m.totalItems + m.guideStepsTotal;
    return sum + (total === 0 ? 0 : (m.completedItems + m.guideStepsCompleted) / total);
  }, 0);
  const overallPct = modules.length > 0 ? Math.round((fractionalDone / modules.length) * 100) : 0;
  const totalItems = modules.reduce((acc, m) => acc + m.totalItems, 0);
  const doneItems = modules.reduce((acc, m) => acc + m.completedItems, 0);
  const itemsPct = totalItems > 0 ? Math.round((doneItems / totalItems) * 100) : 0;

  const nextItem = focus?.items.find((item) => !isCompleted(focus.id, item.id)) ?? null;
  const nextGuideStep = focus ? getNextGuideStep(focus) : null;
  const focusProgress = focus ? getModuleProgressSnapshot(focus) : null;
  const focusItemPct = focusProgress?.pct ?? 0;

  const recentModules = [...modules]
    .filter((m) => m.latest_progress_updated_at)
    .sort((a, b) => (b.latest_progress_updated_at ?? '').localeCompare(a.latest_progress_updated_at ?? ''))
    .slice(0, 3);

  const displayName = greetingName(user.email);

  return (
    <div className="dashboard">
      <section className="dashboard-welcome">
        <h1 className="dashboard-welcome-title">
          Welcome back,
          {' '}
          {displayName}
          .
        </h1>
        <p className="dashboard-welcome-sub">
          Take a breath. Your focus today is building depth, not just clearing tickets.
        </p>
      </section>

      <section className="dashboard-hero-row" aria-label="Current module and progress">
        <div className="dashboard-hero-focus">
          {focus ? (
            <div className="dashboard-focus-gradient" data-track={focus.track}>
              <div className="dashboard-focus-main">
                <div className="dashboard-focus-copy">
                  <p className="dashboard-focus-eyebrow">Currently mastering</p>
                  <h2 className="dashboard-focus-title">{focus.title}</h2>
                  {focusTrack ? (
                    <p className="dashboard-focus-track">{focusTrack.label}</p>
                  ) : null}
                </div>
                <div className="dashboard-focus-side">
                  <div className="dashboard-focus-progress-block">
                    <div className="dashboard-focus-progress-labels">
                      <span>Progress</span>
                      <span>
                        {focusItemPct}
                        % complete
                      </span>
                    </div>
                    <div className="dashboard-focus-progress-track">
                      <div className="dashboard-focus-progress-fill" style={{ width: `${focusItemPct}%` }} />
                    </div>
                  </div>
                  {nextItem ? (
                    <p className="dashboard-focus-next">
                      <span className="dashboard-focus-next-label">Next item</span>
                      {' '}
                      {nextItem.url
                        ? <a href={nextItem.url} target="_blank" rel="noreferrer">{nextItem.label}</a>
                        : <span>{nextItem.label}</span>}
                    </p>
                  ) : nextGuideStep ? (
                    <p className="dashboard-focus-next">
                      <span className="dashboard-focus-next-label">Next guide step</span>
                      {' '}
                      <span>
                        Step
                        {' '}
                        {nextGuideStep}
                        {' '}
                        of
                        {' '}
                        {focus?.guideStepsTotal ?? nextGuideStep}
                      </span>
                    </p>
                  ) : null}
                </div>
                <div className="dashboard-focus-actions">
                  <Link
                    to={`/track/${focus.track}/module/${focus.id}`}
                    className="dashboard-focus-btn-primary"
                  >
                    {getPrimaryActionLabel(focus)}
                  </Link>
                  <Link to={`/track/${focus.track}`} className="dashboard-focus-btn-secondary">
                    View curriculum
                  </Link>
                </div>
              </div>
              <div className="dashboard-focus-glow" aria-hidden="true" />
            </div>
          ) : (
            <div className="dashboard-focus-gradient dashboard-focus-gradient--empty">
              <div className="dashboard-focus-main dashboard-focus-main--empty">
                <p className="dashboard-focus-eyebrow">Ready when you are</p>
                <h2 className="dashboard-focus-title">Pick a lane and start one module.</h2>
                <p className="dashboard-focus-empty-copy">
                  Your order unlocks from the dashboard tracks below—no need to rebuild the plan each week.
                </p>
                <div className="dashboard-focus-actions">
                  <Link to="#tracks" className="dashboard-focus-btn-primary">Browse tracks</Link>
                </div>
              </div>
              <div className="dashboard-focus-glow" aria-hidden="true" />
            </div>
          )}
        </div>

        <div className="dashboard-focus-stats-panel" aria-label="Focus stats">
          <h3 className="dashboard-aside-title">Focus stats</h3>
          <div className="dashboard-stat-highlight">
            <div className="dashboard-stat-highlight-top">
              <span className="dashboard-stat-big">{overallPct}</span>
              <span className="dashboard-stat-big-label">Roadmap complete</span>
            </div>
            <div
              className="dashboard-stat-roadmap-bar"
              role="progressbar"
              aria-valuenow={overallPct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Roadmap completion"
            >
              <div className="dashboard-stat-roadmap-fill" style={{ width: `${overallPct}%` }} />
            </div>
            <p className="dashboard-stat-hint">
              Steady progress beats cramming. Small sessions add up.
            </p>
          </div>
          <div className="dashboard-stat-rows">
            <div className="dashboard-stat-row">
              <span className="dashboard-stat-dot" />
              <div className="dashboard-stat-row-body">
                <div className="dashboard-stat-row-labels">
                  <span>Checklist depth</span>
                  <span>
                    {doneItems}
                    /
                    {totalItems}
                    {' '}
                    items
                  </span>
                </div>
                <div className="dashboard-stat-row-bar">
                  <div style={{ width: `${itemsPct}%` }} />
                </div>
              </div>
            </div>
            <div className="dashboard-stat-row dashboard-stat-row--tertiary">
              <span className="dashboard-stat-dot tertiary" />
              <div className="dashboard-stat-row-body">
                <div className="dashboard-stat-row-labels">
                  <span>Modules in motion</span>
                  <span>{inProgressModules}</span>
                </div>
                <div className="dashboard-stat-row-bar tertiary">
                  <div
                    style={{
                      width: `${publishedModules > 0 ? Math.min(100, (inProgressModules / publishedModules) * 100) : 0}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="dashboard-body">
        <div className="dashboard-tracks-block">
          <div className="dashboard-tracks-heading" id="tracks">
            <div>
              <h3 className="dashboard-tracks-title">Your learning tracks</h3>
              <p className="dashboard-tracks-sub">Manage your long-term skill acquisition.</p>
            </div>
            <Link to="/curriculum" className="dashboard-explore-link">
              Explore all tracks
              <span className="material-symbols-outlined" aria-hidden="true">arrow_forward</span>
            </Link>
          </div>

          <div className="track-grid">
            {tracks.map((track) => (
              <TrackColumn key={track.id} track={track} modules={modules.filter((m) => m.track === track.id)} />
            ))}
          </div>
        </div>

        <section className="dashboard-activity-section" aria-label="Recent activity">
          <div className="dashboard-activity-panel">
            <div className="dashboard-activity-header">
              <h3 className="dashboard-aside-title">Recent activity</h3>
            </div>
            <ul className="dashboard-activity-list">
              {recentModules.length === 0 ? (
                <li className="dashboard-activity-row dashboard-activity-row--empty">
                  <span className="material-symbols-outlined dashboard-activity-icon" aria-hidden="true">history</span>
                  <div>
                    <p className="dashboard-activity-primary">No sessions logged yet</p>
                    <p className="dashboard-activity-meta">Open any module and your recent work will show up here.</p>
                  </div>
                </li>
              ) : (
                recentModules.map((m) => (
                  <li key={m.id} className="dashboard-activity-row">
                    <span className="material-symbols-outlined dashboard-activity-icon" aria-hidden="true">
                      {m.status === 'done' ? 'done_all' : 'history'}
                    </span>
                    <div>
                      <p className="dashboard-activity-primary">
                        {m.status === 'done' ? 'Completed ' : 'Continued '}
                        <Link to={`/track/${m.track}/module/${m.id}`}>{m.title}</Link>
                      </p>
                      <p className="dashboard-activity-meta">
                        {formatRelative(m.latest_progress_updated_at ?? '')}
                        {' · '}
                        {tracks.find((t) => t.id === m.track)?.label ?? m.track}
                      </p>
                    </div>
                  </li>
                ))
              )}
            </ul>
          </div>
        </section>
      </div>
    </div>
  );
}
