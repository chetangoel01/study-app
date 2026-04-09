import { Link } from 'react-router-dom';

const PLACEHOLDER_THREADS = [
  {
    tag: 'System design help',
    meta: 'Sample thread · posting opens when the forum goes live',
    title: 'Scaling microservices: consistent data without global locks?',
    excerpt:
      'A placeholder for the kind of architecture deep-dives we want here—tradeoffs, diagrams, and calm technical debate.',
    replies: '—',
    views: '—',
  },
  {
    tag: 'DSA optimization',
    meta: 'Sample thread · posting opens when the forum goes live',
    title: 'Is O(log n) always better than O(n) for small inputs?',
    excerpt:
      'Placeholder discussion on constants, cache locality, and when simpler scans beat fancy structures.',
    replies: '—',
    views: '—',
  },
] as const;

export function CommunityPage() {
  return (
    <div className="community-page">
      <aside className="community-sidebar surface-card" aria-label="Forum navigation">
        <p className="community-sidebar-heading">Navigation</p>
        <nav className="community-nav">
          <span className="community-nav-item community-nav-item--active">
            <span className="material-symbols-outlined" aria-hidden="true">forum</span>
            All discussions
          </span>
          <span className="community-nav-item community-nav-item--disabled">
            <span className="material-symbols-outlined" aria-hidden="true">star</span>
            Subscribed
          </span>
          <span className="community-nav-item community-nav-item--disabled">
            <span className="material-symbols-outlined" aria-hidden="true">trending_up</span>
            Trending
          </span>
        </nav>
        <div>
          <p className="community-sidebar-heading">Popular tags</p>
          <div className="community-tags">
            {['System design', 'DSA', 'Career', 'Behavioral', 'DevOps'].map((label) => (
              <span key={label} className="community-tag">{label}</span>
            ))}
          </div>
        </div>
      </aside>

      <section className="community-main">
        <div className="community-main-header">
          <div>
            <h1 className="community-title">Community forum</h1>
            <p className="community-lede">
              A focused space for mindful collaboration and technical growth.
            </p>
          </div>
          <button type="button" className="community-new-post" disabled title="Coming soon">
            <span className="material-symbols-outlined" aria-hidden="true">add</span>
            New post
          </button>
        </div>

        <p className="community-banner">
          Threads and replies are not wired up yet—this layout matches the study platform spec while we build the backend.
        </p>

        <div className="community-thread-list">
          {PLACEHOLDER_THREADS.map((thread) => (
            <article key={thread.title} className="community-thread surface-card">
              <div className="community-thread-body">
                <div className="community-thread-meta">
                  <span className="community-thread-chip">{thread.tag}</span>
                  <span aria-hidden="true">·</span>
                  <span>{thread.meta}</span>
                </div>
                <h2 className="community-thread-title">{thread.title}</h2>
                <p className="community-thread-excerpt">{thread.excerpt}</p>
              </div>
              <div className="community-thread-stats">
                <div>
                  <span className="community-thread-stat-val">{thread.replies}</span>
                  <span className="community-thread-stat-lbl">Replies</span>
                </div>
                <div>
                  <span className="community-thread-stat-val">{thread.views}</span>
                  <span className="community-thread-stat-lbl">Views</span>
                </div>
              </div>
            </article>
          ))}
        </div>

        <p className="community-footer-note">
          Prefer structured study first?
          {' '}
          <Link to="/">Back to dashboard</Link>
        </p>
      </section>
    </div>
  );
}
