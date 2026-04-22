import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { useNavigate } from 'react-router-dom';
import type { CommunityTag, CommunityThreadFull } from '../types.js';
import { COMMUNITY_TAG_LABELS, COMMUNITY_TAGS } from '../types.js';
import { AuthorChip } from './AuthorChip.js';
import {
  deleteThread,
  subscribe,
  unsubscribe,
  updateThread,
} from '../hooks/useCommunity.js';

export function ThreadDetailView({
  thread,
  canEdit,
  onChanged,
}: {
  thread: CommunityThreadFull;
  canEdit: boolean;
  onChanged: () => void;
}) {
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(thread.title);
  const [body, setBody] = useState(thread.body_md);
  const [tag, setTag] = useState<CommunityTag>(thread.tag);
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [subscribed, setSubscribed] = useState(thread.isSubscribed);

  useEffect(() => { setSubscribed(thread.isSubscribed); }, [thread.isSubscribed]);

  async function save() {
    setBusy(true);
    setSaveError(null);
    try {
      await updateThread(thread.id, { title: title.trim(), body_md: body, tag });
      setEditing(false);
      onChanged();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm('Delete this thread?')) return;
    setBusy(true);
    setSaveError(null);
    try {
      await deleteThread(thread.id);
      navigate('/community');
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to delete thread');
    } finally {
      setBusy(false);
    }
  }

  async function toggleSub() {
    const next = !subscribed;
    setSubscribed(next);
    try {
      if (next) await subscribe(thread.id);
      else await unsubscribe(thread.id);
    } catch {
      setSubscribed(!next);
    }
  }

  return (
    <article className="thread-detail card-lg">
      <header className="thread-detail-head">
        <span className="badge" data-tag={thread.tag}>
          {COMMUNITY_TAG_LABELS[thread.tag]}
        </span>
        <button
          type="button"
          className={`btn ${subscribed ? 'btn-ghost' : 'btn-primary'}`}
          onClick={toggleSub}
          aria-pressed={subscribed}
        >
          <span className="material-symbols-outlined" aria-hidden="true">
            {subscribed ? 'notifications_active' : 'notifications'}
          </span>
          {subscribed ? 'Subscribed' : 'Subscribe'}
        </button>
      </header>
      {editing ? (
        <>
          <div className="field">
            <label className="field-label">Title</label>
            <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="field">
            <label className="field-label">Tag</label>
            <select className="select" value={tag} onChange={(e) => setTag(e.target.value as CommunityTag)}>
              {COMMUNITY_TAGS.map((t) => (
                <option key={t} value={t}>{COMMUNITY_TAG_LABELS[t]}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label className="field-label">Body</label>
            <textarea className="textarea" rows={10} value={body} onChange={(e) => setBody(e.target.value)} />
          </div>
          {saveError ? <p className="state state-error" role="alert">{saveError}</p> : null}
          <div className="thread-detail-edit-actions">
            <button type="button" className="btn btn-ghost" onClick={() => {
              setEditing(false);
              setSaveError(null);
              setTitle(thread.title); setBody(thread.body_md); setTag(thread.tag);
            }}>Cancel</button>
            <button type="button" className="btn btn-primary" onClick={save} disabled={busy}>Save</button>
          </div>
        </>
      ) : (
        <>
          <h1 className="thread-detail-title">{thread.title}</h1>
          <AuthorChip
            author={thread.author}
            timestamp={thread.createdAt}
            editedAt={thread.editedAt}
          />
          <div className="markdown-body thread-detail-body">
            <ReactMarkdown>{thread.body_md || ''}</ReactMarkdown>
          </div>
          {canEdit ? (
            <div className="thread-detail-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setEditing(true)}>Edit</button>
              <button type="button" className="btn btn-ghost" onClick={remove} disabled={busy}>Delete</button>
            </div>
          ) : null}
        </>
      )}
    </article>
  );
}
