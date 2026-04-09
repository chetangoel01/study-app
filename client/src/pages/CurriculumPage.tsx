import { Link } from 'react-router-dom';
import { useCurriculum } from '../hooks/useCurriculum.js';
import { TrackColumn } from '../components/TrackColumn.js';

export function CurriculumPage() {
  const { data, loading, error } = useCurriculum();

  if (loading) return <div className="loading" role="status" aria-live="polite">Loading curriculum...</div>;
  if (error) return <div className="error" role="alert">Error: {error}</div>;
  if (!data) return null;

  const { tracks, modules } = data;

  return (
    <div className="track-page">
      <nav className="page-breadcrumb" aria-label="Breadcrumb">
        <Link to="/">Dashboard</Link>
        <span className="material-symbols-outlined page-breadcrumb-chevron" aria-hidden="true">chevron_right</span>
        <span className="page-breadcrumb-current">Curriculum</span>
      </nav>

      <header className="track-page-header-stitch">
        <div className="track-page-header-main">
          <h1 className="track-page-title-stitch">Curriculum</h1>
          <p className="track-meta track-meta-stitch">
            Your overarching learning paths. Pick a track to see the recommended module roadmap.
          </p>
        </div>
      </header>

      <div className="dashboard-body" style={{ marginTop: '3rem' }}>
        <div className="dashboard-tracks-block">
          <div className="track-grid">
            {tracks.map((track) => (
              <TrackColumn key={track.id} track={track} modules={modules.filter((m) => m.track === track.id)} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
