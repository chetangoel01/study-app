import { Link } from 'react-router-dom';
import type { CurriculumModule } from '../types.js';

const STATUS_LABELS = { done: 'Done', 'in-progress': 'In progress', available: 'Available', 'soft-locked': 'Soft-locked' };

interface Props {
  module: CurriculumModule;
  compact?: boolean;
  allModules?: CurriculumModule[];  // needed for soft-locked prereq name display
}

export function ModuleCard({ module: m, compact = false, allModules = [] }: Props) {
  const pct = m.totalItems > 0 ? Math.round((m.completedItems / m.totalItems) * 100) : 0;
  const prereqNames = m.status === 'soft-locked' && m.blockedBy.length > 0
    ? m.blockedBy.map((pid) => allModules.find((mod) => mod.id === pid)?.title ?? pid)
    : [];
  return (
    <Link to={`/track/${m.track}/module/${m.id}`} className={`module-card status-${m.status}${compact ? ' compact' : ''}`}>
      <div className="module-card-header">
        <span className="module-phase">{m.phase}</span>
        <span className={`status-chip status-${m.status}`}>{STATUS_LABELS[m.status]}</span>
      </div>
      <strong className="module-title">{m.title}</strong>
      {!compact && (
        <>
          <span className="module-estimate">{m.estimate}</span>
          {prereqNames.length > 0 && (
            <span className="prereq-hint">Requires: {prereqNames.join(', ')}</span>
          )}
          <div className="progress-bar"><div className="progress-fill" style={{ width: `${pct}%` }} /></div>
        </>
      )}
    </Link>
  );
}
