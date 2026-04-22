import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useCommunityThreads } from '../hooks/useCommunity.js';
import {
  COMMUNITY_TAGS,
  COMMUNITY_TAG_LABELS,
  type CommunityFilter,
  type CommunityTag,
} from '../types.js';
import { ThreadListItem } from '../components/ThreadListItem.js';
import { NewThreadModal } from '../components/NewThreadModal.js';

const FILTERS: Array<{ id: CommunityFilter; label: string; icon: string }> = [
  { id: 'all',        label: 'All discussions', icon: 'forum' },
  { id: 'subscribed', label: 'Subscribed',      icon: 'star' },
  { id: 'trending',   label: 'Trending',        icon: 'trending_up' },
];

export function CommunityPage() {
  const [params, setParams] = useSearchParams();
  const filter = (params.get('filter') as CommunityFilter) ?? 'all';
  const tagParam = params.get('tag');
  const tag = (COMMUNITY_TAGS as readonly string[]).includes(tagParam ?? '')
    ? (tagParam as CommunityTag)
    : null;
  const [showNew, setShowNew] = useState(false);
  const { threads, loading, error, refresh } = useCommunityThreads({ filter, tag });

  function setFilter(next: CommunityFilter) {
    const p = new URLSearchParams(params);
    p.set('filter', next);
    setParams(p, { replace: true });
  }
  function toggleTag(next: CommunityTag) {
    const p = new URLSearchParams(params);
    if (tag === next) p.delete('tag');
    else p.set('tag', next);
    setParams(p, { replace: true });
  }

  return (
    <div className="community-page">
      <aside className="community-sidebar card card-subtle" aria-label="Forum navigation">
        <p className="community-sidebar-heading">Navigation</p>
        <nav className="community-nav">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              className={`community-nav-item ${filter === f.id ? 'community-nav-item--active' : ''}`}
              onClick={() => setFilter(f.id)}
            >
              <span className="material-symbols-outlined" aria-hidden="true">{f.icon}</span>
              {f.label}
            </button>
          ))}
        </nav>
        <div>
          <p className="community-sidebar-heading">Tags</p>
          <div className="community-tags">
            {COMMUNITY_TAGS.map((t) => (
              <button
                key={t}
                type="button"
                className={`community-tag ${tag === t ? 'community-tag--active' : ''}`}
                onClick={() => toggleTag(t)}
              >
                {COMMUNITY_TAG_LABELS[t]}
              </button>
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
          <button type="button" className="btn btn-primary community-new-post" onClick={() => setShowNew(true)}>
            <span className="material-symbols-outlined" aria-hidden="true">add</span>
            New post
          </button>
        </div>

        {loading ? (
          <div className="community-thread-list" role="status" aria-label="Loading discussions">
            {[0, 1, 2].map((i) => (
              <div key={i} className="thread-row-skeleton card">
                <div className="skeleton thread-row-skeleton-badge" />
                <div className="skeleton thread-row-skeleton-title" />
                <div className="skeleton thread-row-skeleton-line" />
                <div className="skeleton thread-row-skeleton-line thread-row-skeleton-line--short" />
              </div>
            ))}
          </div>
        ) : error ? (
          <p className="state state-error" role="alert">{error}</p>
        ) : threads.length === 0 ? (
          <EmptyState filter={filter} tag={tag} />
        ) : (
          <div className="community-thread-list">
            {threads.map((t) => <ThreadListItem key={t.id} thread={t} />)}
          </div>
        )}

        <p className="community-footer-note">
          Prefer structured study first? <Link to="/">Back to dashboard</Link>
        </p>
      </section>

      {showNew ? (
        <NewThreadModal
          onClose={() => setShowNew(false)}
          onCreated={(id) => {
            setShowNew(false);
            window.location.assign(`/community/t/${id}`);
            refresh();
          }}
        />
      ) : null}
    </div>
  );
}

function EmptyState({ filter, tag }: { filter: CommunityFilter; tag: CommunityTag | null }) {
  if (filter === 'subscribed') {
    return (
      <div className="state">
        <span className="state-icon material-symbols-outlined" aria-hidden="true">star</span>
        <p className="state-title">No subscribed threads yet</p>
        <p className="state-sub">Subscribe to threads and they'll collect here. <Link to="/community?filter=all">Browse all</Link>.</p>
      </div>
    );
  }
  if (filter === 'trending') {
    return (
      <div className="state">
        <span className="state-icon material-symbols-outlined" aria-hidden="true">trending_up</span>
        <p className="state-title">Nothing hot right now</p>
        <p className="state-sub">Check back after folks post.</p>
      </div>
    );
  }
  return (
    <div className="state">
      <span className="state-icon material-symbols-outlined" aria-hidden="true">forum</span>
      <p className="state-title">Be the first to start a discussion</p>
      <p className="state-sub">{tag ? `No threads tagged ${tag}.` : 'This space is waiting for its first post.'}</p>
    </div>
  );
}
