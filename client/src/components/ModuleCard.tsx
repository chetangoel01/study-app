import { Link } from 'react-router-dom';
import type { CurriculumModule } from '../types.js';

const STATUS_LABELS = {
  done: 'Done',
  'in-progress': 'In progress',
  available: 'Available',
  'soft-locked': 'Locked',
};

interface Props {
  module: CurriculumModule;
  compact?: boolean;
  linked?: boolean;
  allModules?: CurriculumModule[];  // needed for soft-locked prereq name display
}

export function ModuleCard({ module: m, compact = false, linked = true, allModules = [] }: Props) {
  const pct = m.totalItems > 0 ? Math.round((m.completedItems / m.totalItems) * 100) : 0;
  const prereqNames = m.status === 'soft-locked' && m.blockedBy.length > 0
    ? m.blockedBy.map((pid) => allModules.find((mod) => mod.id === pid)?.title ?? pid)
    : [];
  const footerMeta = compact ? m.estimate : `${m.completedItems}/${m.totalItems} items`;
  const ctaLabel = m.status === 'soft-locked' ? 'Locked' : m.status === 'done' ? 'Review' : 'Open';
  const cardClassName = `module-card status-${m.status}${compact ? ' compact' : ''}`;

  const content = (
    <>
      <div className="module-card-header">
        <span className="module-phase">{m.phase}</span>
        <span className={`status-chip status-${m.status}`}>{STATUS_LABELS[m.status]}</span>
      </div>
      <strong className="module-title">{m.title}</strong>
      {!compact && <p className="module-summary">{m.summary}</p>}
      {!compact && (
        <>
          <div className="module-meta-row">
            <span className="module-estimate">{m.estimate}</span>
            <span className="module-sessions">{m.sessions} sessions</span>
          </div>
          {prereqNames.length > 0 && (
            <span className="prereq-hint">Requires: {prereqNames.join(', ')}</span>
          )}
          <div className="progress-bar"><div className="progress-fill" style={{ width: `${pct}%` }} /></div>
        </>
      )}
      <div className="module-card-footer">
        <span className="module-footer-meta">{footerMeta}</span>
        <span className="module-open-hint">{ctaLabel}</span>
      </div>
    </>
  );

  if (!linked) {
    return <div className={cardClassName} data-track={m.track}>{content}</div>;
  }

  return (
    <Link to={`/track/${m.track}/module/${m.id}`} className={cardClassName} data-track={m.track}>
      {content}
    </Link>
  );
}
