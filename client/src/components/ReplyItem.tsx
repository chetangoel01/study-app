import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import type { CommunityReply } from '../types.js';
import { AuthorChip } from './AuthorChip.js';
import { deleteReply, updateReply } from '../hooks/useCommunity.js';

export function ReplyItem({
  reply,
  onChanged,
}: {
  reply: CommunityReply;
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(reply.body_md);
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setSaveError(null);
    try {
      await updateReply(reply.id, draft);
      setEditing(false);
      onChanged();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm('Delete this reply?')) return;
    setBusy(true);
    setSaveError(null);
    try {
      await deleteReply(reply.id);
      onChanged();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to delete reply');
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className={`reply card-subtle ${reply.deletedAt ? 'reply-deleted' : ''}`}>
      <header className="reply-head">
        <AuthorChip
          author={reply.author}
          timestamp={reply.createdAt}
          editedAt={reply.editedAt}
        />
        {reply.canEdit && !editing ? (
          <div className="reply-actions">
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(true)}>Edit</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={remove} disabled={busy}>Delete</button>
          </div>
        ) : null}
      </header>
      {editing ? (
        <>
          <textarea
            className="textarea"
            rows={5}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
          {saveError ? <p className="state state-error" role="alert">{saveError}</p> : null}
          <div className="reply-edit-actions">
            <button type="button" className="btn btn-ghost" onClick={() => { setEditing(false); setSaveError(null); setDraft(reply.body_md); }}>Cancel</button>
            <button type="button" className="btn btn-primary" onClick={save} disabled={busy}>Save</button>
          </div>
        </>
      ) : (
        <div className="markdown-body">
          <ReactMarkdown>{reply.body_md}</ReactMarkdown>
        </div>
      )}
    </article>
  );
}
