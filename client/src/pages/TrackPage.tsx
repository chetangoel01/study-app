import { Link, useParams } from 'react-router-dom';
import { useCurriculum } from '../hooks/useCurriculum.js';
import { ModuleCard } from '../components/ModuleCard.js';

export function TrackPage() {
  const { trackId } = useParams<{ trackId: string }>();
  const { data, loading, error } = useCurriculum();

  if (loading) return <div className="loading">Loading…</div>;
  if (error) return <div className="error">{error}</div>;
  if (!data || !trackId) return null;

  const track = data.tracks.find((t) => t.id === trackId);
  const modules = data.modules.filter((m) => m.track === trackId);
  if (!track) return <div className="error">Track not found.</div>;

  const done = modules.filter((m) => m.status === 'done').length;

  return (
    <div className="track-page">
      <div className="track-page-header">
        <Link to="/" className="back-link">← Dashboard</Link>
        <h1>{track.label}</h1>
        <p className="track-meta">{done} / {modules.length} modules complete</p>
      </div>
      <div className="module-list">
        {modules.map((m) => <ModuleCard key={m.id} module={m} allModules={data.modules} />)}
      </div>
    </div>
  );
}
