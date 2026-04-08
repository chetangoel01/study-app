import { useNavigate } from 'react-router-dom';
import { useCurriculum } from '../hooks/useCurriculum.js';
import { useProgress } from '../hooks/useProgress.js';
import { TrackColumn } from '../components/TrackColumn.js';
import type { CurriculumModule } from '../types.js';

// Per spec: most recently touched in-progress module; fallback to first available in dsa-leetcode
function pickFocus(modules: CurriculumModule[]): CurriculumModule | null {
  const inProgress = modules.filter((m) => m.status === 'in-progress');
  if (inProgress.length > 0) {
    return inProgress.sort((a, b) => {
      const ta = a.latest_progress_updated_at ?? '';
      const tb = b.latest_progress_updated_at ?? '';
      return tb.localeCompare(ta); // descending — most recent first
    })[0];
  }
  return modules.find((m) => m.track === 'dsa-leetcode' && m.status === 'available') ?? null;
}

export function DashboardPage() {
  const { data, loading, error } = useCurriculum();
  const { isCompleted } = useProgress();
  const navigate = useNavigate();

  if (loading) return <div className="loading">Loading curriculum…</div>;
  if (error) return <div className="error">Error: {error}</div>;
  if (!data) return null;

  const { tracks, modules } = data;
  const focus = pickFocus(modules);

  // Find the next unchecked item for the focus module (spec: "next unchecked item" shown in card)
  const nextItem = focus?.items.find((item) => !isCompleted(focus.id, item.id)) ?? null;

  return (
    <div className="dashboard">
      {focus && (
        <div className="what-to-do-now">
          <p className="panel-label">What to do now</p>
          <h2>{focus.title}</h2>
          <p className="focus-meta">
            {focus.estimate} · {focus.completedItems} of {focus.totalItems} items done
          </p>
          {nextItem && (
            <p className="focus-next-item">
              Next: {nextItem.url
                ? <a href={nextItem.url} target="_blank" rel="noreferrer">{nextItem.label}</a>
                : <span>{nextItem.label}</span>}
            </p>
          )}
          <button className="open-module-btn"
            onClick={() => navigate(`/track/${focus.track}/module/${focus.id}`)}>
            Open module →
          </button>
        </div>
      )}
      <div className="track-grid">
        {tracks.map((track) => (
          <TrackColumn key={track.id} track={track}
            modules={modules.filter((m) => m.track === track.id)} />
        ))}
      </div>
    </div>
  );
}
