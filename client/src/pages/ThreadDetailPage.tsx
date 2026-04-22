import { Link, useParams } from 'react-router-dom';
import { useCommunityThread } from '../hooks/useCommunity.js';
import { ThreadDetailView } from '../components/ThreadDetailView.js';
import { ReplyItem } from '../components/ReplyItem.js';
import { ReplyComposer } from '../components/ReplyComposer.js';

export function ThreadDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data, loading, error, refresh } = useCommunityThread(id);

  if (loading) return <div className="state" role="status">Loading…</div>;
  if (error) return <div className="state state-error" role="alert">{error}</div>;
  if (!data || !id) return null;

  return (
    <div className="thread-detail-page">
      <p className="thread-detail-crumbs">
        <Link to="/community">← Back to discussions</Link>
      </p>
      <ThreadDetailView thread={data.thread} canEdit={data.canEdit} onChanged={refresh} />
      <section className="thread-replies">
        <h2>Replies ({data.replies.length})</h2>
        {data.replies.map((r) => (
          <ReplyItem key={r.id} reply={r} onChanged={refresh} />
        ))}
        {!data.thread.deletedAt ? (
          <ReplyComposer threadId={id} onPosted={refresh} />
        ) : null}
      </section>
    </div>
  );
}
