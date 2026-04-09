import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useCurriculum } from '../hooks/useCurriculum.js';
import { TrackColumn } from '../components/TrackColumn.js';

const UPCOMING_CURRICULA = [
  {
    id: 'frontend-engineering',
    title: 'Frontend Engineering',
    icon: 'web',
    summary: 'Component architecture, accessibility, state flows, and UI performance for product-facing teams.',
    preview: 'Planned modules: rendering, interaction patterns, design systems, debugging.',
    iconBackground: 'rgba(79, 93, 140, 0.16)',
    iconColor: '#4f5d8c',
  },
  {
    id: 'backend-apis',
    title: 'Backend & APIs',
    icon: 'dns',
    summary: 'Service boundaries, API design, persistence choices, and pragmatic reliability fundamentals.',
    preview: 'Planned modules: HTTP, databases, queues, caching, observability.',
    iconBackground: 'rgba(250, 116, 111, 0.16)',
    iconColor: '#a83836',
  },
  {
    id: 'devops-cloud',
    title: 'DevOps & Cloud',
    icon: 'cloud',
    summary: 'Delivery pipelines, infrastructure basics, incident readiness, and cloud trade-off fluency.',
    preview: 'Planned modules: CI/CD, containers, deployments, platform operations.',
    iconBackground: 'rgba(78, 146, 132, 0.18)',
    iconColor: '#2d6f62',
  },
  {
    id: 'security-reliability',
    title: 'Security & Reliability',
    icon: 'verified_user',
    summary: 'Threat modeling, auth patterns, safe defaults, and the operational habits behind trustworthy systems.',
    preview: 'Planned modules: auth, secrets, failure modes, resilience, review checklists.',
    iconBackground: 'rgba(210, 182, 102, 0.18)',
    iconColor: '#8a6b20',
  },
] as const;

export function CurriculumPage() {
  const { data, loading, error } = useCurriculum();
  const heroRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const hero = heroRef.current;
    if (!hero) return;
    const onScroll = () => {
      const progress = Math.min(window.scrollY / 200, 1);
      hero.style.setProperty('--sp', progress.toFixed(3));
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  if (loading) return <div className="loading" role="status" aria-live="polite">Loading curriculum...</div>;
  if (error) return <div className="error" role="alert">Error: {error}</div>;
  if (!data) return null;

  const { tracks, modules } = data;
  const trackGroups = tracks.map((track) => ({
    track,
    modules: modules.filter((module) => module.track === track.id),
  }));
  const liveTrackCount = trackGroups.filter(({ modules: groupedModules }) => groupedModules.length > 0).length;
  const publishedModules = modules.length;

  return (
    <div className="curriculum-page">
      <header ref={heroRef} className="curriculum-hero" style={{ '--sp': '0' } as React.CSSProperties}>
        <h1 className="curriculum-title">Curriculum</h1>
        <p className="curriculum-copy">
          Pick a track and follow the sequence. Each roadmap is structured, sequenced, and built for depth.
        </p>
        <p className="curriculum-stat-line" aria-label="Curriculum snapshot">
          <span>{liveTrackCount} live tracks</span>
          <span className="curriculum-stat-dot" aria-hidden="true" />
          <span>{publishedModules} modules</span>
          <span className="curriculum-stat-dot" aria-hidden="true" />
          <span>{UPCOMING_CURRICULA.length} coming soon</span>
        </p>
      </header>

      <div className="curriculum-sections">
        <section className="curriculum-section-shell" aria-labelledby="curriculum-live-title">
          <h2 id="curriculum-live-title" className="curriculum-section-title">Live roadmaps</h2>

          <div className="track-grid curriculum-track-grid">
            {trackGroups.map(({ track, modules: groupedModules }) => (
              <TrackColumn key={track.id} track={track} modules={groupedModules} />
            ))}
          </div>
        </section>

        <section className="curriculum-section-shell" aria-labelledby="curriculum-upcoming-title">
          <h2 id="curriculum-upcoming-title" className="curriculum-section-title">Coming soon</h2>
          <ul className="curriculum-coming-list" role="list">
            {UPCOMING_CURRICULA.map((lane) => (
              <li key={lane.id} className="curriculum-coming-row">
                <div
                  className="curriculum-coming-icon"
                  style={{ background: lane.iconBackground, color: lane.iconColor }}
                  aria-hidden="true"
                >
                  <span className="material-symbols-outlined">{lane.icon}</span>
                </div>
                <div className="curriculum-coming-text">
                  <span className="curriculum-coming-title">{lane.title}</span>
                  <span className="curriculum-coming-copy">{lane.summary}</span>
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* Scroll padding — remove once real content fills this space */}
        <section className="curriculum-section-shell" aria-hidden="true" style={{ opacity: 0.4, pointerEvents: 'none' }}>
          <h2 className="curriculum-section-title">Resources</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {['The Algorithm Design Manual', 'Designing Data-Intensive Applications', 'Cracking the Coding Interview', 'Clean Code', 'System Design Interview'].map((title) => (
              <div key={title} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 0', borderBottom: '1px solid var(--ghost-border)' }}>
                <div style={{ width: '2rem', height: '2rem', borderRadius: 'var(--radius-sm)', background: 'var(--surface-container-high)', flexShrink: 0 }} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                  <span style={{ fontSize: '0.95rem', fontFamily: 'var(--font-display)' }}>{title}</span>
                  <span style={{ fontSize: '0.82rem', color: 'var(--muted)' }}>Reference reading</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
