import { useEffect } from 'react';
import { usePracticeStats } from '../hooks/usePractice.js';

interface Props {
  onClose: () => void;
}

export function PracticeHistoryModal({ onClose }: Props) {
  const { data: stats, loading } = usePracticeStats();

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-panel history-modal" onClick={(e) => e.stopPropagation()}>
        <div className="report-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2>Practice Session History</h2>
          <button className="secondary-link" onClick={onClose}>Close</button>
        </div>
        
        {loading ? (
          <div className="loading" style={{ height: '300px' }}>Loading history...</div>
        ) : (
          <div className="history-content" style={{ marginTop: '24px', maxHeight: '600px', overflowY: 'auto' }}>
            <div className="recent-sessions-list">
              {(stats?.recentSessions || []).length > 0 ? (
                stats.recentSessions.map((session: any) => (
                  <div key={session.id} className="recent-session-item" style={{ padding: '16px', borderBottom: '1px solid var(--border)' }}>
                    <div className="session-info">
                      <div className={`session-status ${session.score === 100 ? 'green' : 'purple'}`}></div>
                      <div className="session-details">
                        <span className="session-title">{session.title}</span>
                        <span className="session-date">{new Date(session.createdAt).toLocaleString()}</span>
                      </div>
                    </div>
                    <div className="session-meta">
                      <span className="session-duration">{Math.round(session.durationSeconds / 60)} mins</span>
                      <span className="session-score">Score: {session.score}%</span>
                    </div>
                  </div>
                ))
              ) : (
                <div style={{ padding: '24px', textAlign: 'center', color: 'var(--muted)' }}>
                  No sessions recorded yet. Start practicing!
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
