import { Link } from 'react-router-dom';
import type { CurriculumModule, Track } from '../types.js';
import { TRACK_BLURBS } from '../trackMeta.js';

const EMPTY_TRACK_COPY: Partial<Record<Track['id'], string>> = {
  'machine-learning': 'Machine-learning interview modules are still being published in the app.',
  'system-design': 'This lane stays intentionally lightweight until you need senior-level design rounds.',
  'resume-behavioral': 'Behavioral polish is condensed for now while we expand the supporting drills.',
};

const TRACK_ICON: Record<Track['id'], string> = {
  'machine-learning': 'psychology',
  'system-design': 'hub',
  'resume-behavioral': 'badge',
  'dsa-leetcode': 'rebase_edit',
};

function advisoryBlocked(module: CurriculumModule, inTrack: CurriculumModule[]): boolean {
  return module.blockedBy.some((id) => {
    const prereq = inTrack.find((m) => m.id === id);
    return Boolean(prereq && prereq.status !== 'done');
  });
}

export function TrackColumn({ track, modules }: { track: Track; modules: CurriculumModule[] }) {
  const done = modules.filter((m) => m.status === 'done').length;
  const fractionalDone = modules.reduce((sum, m) => {
    if (m.status === 'done') return sum + 1;
    const total = m.totalItems + m.guideStepsTotal;
    return sum + (total === 0 ? 0 : (m.completedItems + m.guideStepsCompleted) / total);
  }, 0);
  const pct = modules.length > 0 ? Math.round((fractionalDone / modules.length) * 100) : 0;
  const remainingModules = modules.filter((m) => m.status !== 'done');
  const preview = remainingModules.slice(0, 2);
  const previewOverflow = Math.max(remainingModules.length - preview.length, 0);
  const isEmpty = modules.length === 0;
  const emptyCopy = EMPTY_TRACK_COPY[track.id] ?? 'This lane is still being fleshed out in the curriculum.';
  const icon = TRACK_ICON[track.id];

  return (
    <Link to={`/track/${track.id}`} className="track-column track-column-stitch" data-track={track.id}>
      <div className="track-col-top">
        <div className={`track-col-icon-wrap track-col-icon-wrap--${track.id}`}>
          <span className="material-symbols-outlined" aria-hidden="true">{icon}</span>
        </div>
        <span className="track-col-pct">{pct}%</span>
      </div>
      <h4 className="track-col-title">{track.label}</h4>
      <div className="track-col-bar">
        <div className="track-col-bar-fill" style={{ width: `${pct}%` }} />
      </div>

      {isEmpty ? (
        <div className="track-col-empty">
          <strong>No published modules yet</strong>
          <span>{emptyCopy}</span>
        </div>
      ) : (
        <div className="track-col-modules-bucket">
          <p className="track-col-next-label">Next up</p>
          <div className="track-col-next-list">
            {preview.length === 0 ? (
              <p className="track-col-all-done">All complete in this track.</p>
            ) : (
              preview.map((m) => {
                const lockedRow = advisoryBlocked(m, modules);
                const rowClass = lockedRow
                  ? 'track-col-next-row track-col-next-row--locked'
                  : 'track-col-next-row';

                return (
                  <div key={m.id} className={rowClass}>
                    <span className="material-symbols-outlined" aria-hidden="true">
                      {lockedRow ? 'lock' : 'play_circle'}
                    </span>
                    <span className="track-col-next-title">{m.title}</span>
                  </div>
                );
              })
            )}
          </div>
          {previewOverflow > 0 ? (
            <p className="track-col-more">{previewOverflow} more modules in this track</p>
          ) : null}
        </div>
      )}

      <div className="track-column-footer">
        <span>View roadmap</span>
        <span className="material-symbols-outlined track-column-arrow" aria-hidden="true">arrow_forward</span>
      </div>
      <span className="sr-only">{TRACK_BLURBS[track.id]}</span>
    </Link>
  );
}
