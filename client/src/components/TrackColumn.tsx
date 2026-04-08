import { Link } from 'react-router-dom';
import type { CurriculumModule, Track } from '../types.js';
import { ModuleCard } from './ModuleCard.js';
import { TRACK_BLURBS } from '../trackMeta.js';

export function TrackColumn({ track, modules }: { track: Track; modules: CurriculumModule[] }) {
  const done = modules.filter((m) => m.status === 'done').length;
  const pct = modules.length > 0 ? Math.round((done / modules.length) * 100) : 0;
  const remainingModules = modules.filter((m) => m.status !== 'done');
  const preview = remainingModules.slice(0, 3);
  const remaining = modules.length - done;
  const previewOverflow = Math.max(remainingModules.length - preview.length, 0);

  return (
    <Link to={`/track/${track.id}`} className="track-column" data-track={track.id}>
      <div className="track-header">
        <div>
          <p className="track-kicker">Track</p>
          <strong className="track-label">{track.label}</strong>
        </div>
        <span className="track-pct">{pct}%</span>
      </div>
      <p className="track-description">{TRACK_BLURBS[track.id]}</p>
      <div className="track-progress-meta">
        <span>{done} of {modules.length} modules complete</span>
        <span>{remaining === 0 ? 'Finished' : `${remaining} left`}</span>
      </div>
      <div className="track-progress-bar">
        <div className="track-progress-fill" style={{ width: `${pct}%` }} />
      </div>
      <div className="track-modules">
        {preview.map((m) => <ModuleCard key={m.id} module={m} compact linked={false} />)}
        {previewOverflow > 0 && (
          <p className="track-more">{previewOverflow} more modules waiting in this track</p>
        )}
        {preview.length === 0 && <p className="track-complete-msg">All complete!</p>}
      </div>
      <div className="track-column-footer">
        <span>View roadmap</span>
        <span className="track-column-arrow" aria-hidden="true">+</span>
      </div>
    </Link>
  );
}
