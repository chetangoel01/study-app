import { useEffect } from 'react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from 'recharts';
import { usePracticeStats } from '../hooks/usePractice.js';

interface Props {
  onClose: () => void;
}

export function DetailedReportModal({ onClose }: Props) {
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
      <div className="modal-panel report-modal" onClick={(e) => e.stopPropagation()}>
        <div className="report-header">
          <h2>Cognitive Mastery Report</h2>
          <button className="secondary-link" onClick={onClose}>Close</button>
        </div>
        
        {loading ? (
          <div className="loading" style={{ height: '300px' }}>Analyzing skills...</div>
        ) : (
          <div className="report-content">
            <p className="modal-body">
              This chart visualizes your comparative mastery across core computer science and engineering disciplines. Expanding area represents consistent high-scoring drill performance.
            </p>
            
            <div className="radar-chart-container" style={{ width: '100%', height: 400, marginTop: '24px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="80%" data={stats?.skillBreakdown || []}>
                  <PolarGrid stroke="var(--border)" />
                  <PolarAngleAxis dataKey="name" tick={{ fill: 'var(--text-color)', fontSize: 12, fontFamily: 'Manrope' }} />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                  <Radar
                    name="Mastery"
                    dataKey="score"
                    stroke="#8B5CF6"
                    fill="#8B5CF6"
                    fillOpacity={0.5}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
