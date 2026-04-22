import { Link } from 'react-router-dom';
import type { CommunityThread } from '../types.js';
import { COMMUNITY_TAG_LABELS } from '../types.js';
import { AuthorChip } from './AuthorChip.js';

export function ThreadListItem({ thread }: { thread: CommunityThread }) {
  return (
    <Link to={`/community/t/${thread.id}`} className="thread-row card">
      <div className="thread-row-head">
        <span className="badge" data-tag={thread.tag}>
          {COMMUNITY_TAG_LABELS[thread.tag]}
        </span>
        {thread.isSubscribed ? (
          <span className="badge badge-info">Subscribed</span>
        ) : null}
      </div>
      <h2 className="thread-row-title">{thread.title}</h2>
      <p className="thread-row-excerpt">{thread.excerpt}</p>
      <div className="thread-row-foot">
        <AuthorChip
          author={thread.author}
          timestamp={thread.createdAt}
          editedAt={thread.editedAt}
        />
        <span className="thread-row-stats">
          <span>{thread.replyCount} replies</span>
          <span aria-hidden="true">·</span>
          <span>{thread.viewCount} views</span>
        </span>
      </div>
    </Link>
  );
}
