import { useState } from 'react';
import { createThread } from '../hooks/useCommunity.js';
import { COMMUNITY_TAGS, COMMUNITY_TAG_LABELS } from '../types.js';
import type { CommunityTag } from '../types.js';

const TITLE_MAX = 200;
const BODY_MAX = 20_000;

export function NewThreadModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [tag, setTag] = useState<CommunityTag>('dsa');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const titleTrim = title.trim();
  const bodyOk = body.length > 0 && body.length <= BODY_MAX;
  const canSubmit = titleTrim.length > 0 && titleTrim.length <= TITLE_MAX && bodyOk && !submitting;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const { thread } = await createThread({ title: titleTrim, body_md: body, tag });
      onCreated(thread.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create thread');
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-scrim" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <form onSubmit={submit} className="new-thread-form">
          <h2 className="modal-title">New discussion</h2>
          <div className="field">
            <label className="field-label" htmlFor="nt-title">Title</label>
            <input
              id="nt-title" className="input"
              value={title} onChange={(e) => setTitle(e.target.value)}
              maxLength={TITLE_MAX + 1}
              placeholder="A clear question or topic"
            />
          </div>
          <div className="field">
            <label className="field-label" htmlFor="nt-tag">Tag</label>
            <select
              id="nt-tag" className="select"
              value={tag} onChange={(e) => setTag(e.target.value as CommunityTag)}
            >
              {COMMUNITY_TAGS.map((t) => (
                <option key={t} value={t}>{COMMUNITY_TAG_LABELS[t]}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label className="field-label" htmlFor="nt-body">Body <span className="field-hint">Markdown supported</span></label>
            <textarea
              id="nt-body" className="textarea"
              rows={10}
              value={body} onChange={(e) => setBody(e.target.value)}
            />
            <p className="field-help">
              {body.length} / {BODY_MAX}
            </p>
          </div>
          {error ? <p className="state state-error" role="alert">{error}</p> : null}
          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={!canSubmit}>
              {submitting ? 'Posting…' : 'Post'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
