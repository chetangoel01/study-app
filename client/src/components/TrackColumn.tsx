import { Link } from 'react-router-dom';
import type { CurriculumModule, Track } from '../types.js';
import { ModuleCard } from './ModuleCard.js';

export function TrackColumn({ track, modules }: { track: Track; modules: CurriculumModule[] }) {
  const done = modules.filter((m) => m.status === 'done').length;
  const pct = modules.length > 0 ? Math.round((done / modules.length) * 100) : 0;
  const preview = modules.filter((m) => m.status !== 'done').slice(0, 4);

  return (
    <Link to={`/track/${track.id}`} className="track-column">
      <div className="track-header">
        <strong className="track-label">{track.label}</strong>
        <span className="track-pct">{pct}%</span>
      </div>
      <div className="track-progress-bar"><div className="track-progress-fill" style={{ width: `${pct}%` }} /></div>
      <div className="track-modules">
        {preview.map((m) => <ModuleCard key={m.id} module={m} compact />)}
        {preview.length === 0 && <p className="track-complete-msg">All complete!</p>}
      </div>
    </Link>
  );
}
