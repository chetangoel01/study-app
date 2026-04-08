import { Link } from 'react-router-dom';

interface Props {
  moduleTitle: string;
  checksDone: number;
  nextModuleId: string | null;
  nextModuleTitle: string | null;
  trackId: string;
  onClose: () => void;
}

export function ModuleCompletionModal({
  moduleTitle,
  checksDone,
  nextModuleId,
  nextModuleTitle,
  trackId,
  onClose,
}: Props) {
  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="completion-title"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="modal-panel completion-modal" onClick={(event) => event.stopPropagation()}>
        <div className="completion-icon" aria-hidden="true">🌲</div>
        <p className="modal-kicker">Achievement unlocked</p>
        <h2 id="completion-title" className="modal-title">Module Complete</h2>
        <p className="completion-subtitle">{moduleTitle}</p>
        <p className="modal-body">
          You&apos;ve successfully explored the complexities of this topic.
          Take a moment to appreciate your progress.
        </p>
        <div className="completion-stats">
          <div className="completion-stat">
            <strong>{checksDone}</strong>
            <span>checkpoints done</span>
          </div>
        </div>
        <div className="modal-actions">
          {nextModuleId && nextModuleTitle ? (
            <Link
              to={`/track/${trackId}/module/${nextModuleId}`}
              className="primary-action"
              onClick={onClose}
            >
              Next Module: {nextModuleTitle} →
            </Link>
          ) : null}
          <Link to={`/track/${trackId}`} className="secondary-link" onClick={onClose}>
            Return to Roadmap
          </Link>
        </div>
        <p className="completion-ghost" aria-hidden="true">{moduleTitle.toUpperCase()}</p>
      </div>
    </div>
  );
}
