import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { createReply } from '../hooks/useCommunity.js';

const REPLY_MAX = 10_000;

export function ReplyComposer({
  threadId,
  onPosted,
}: {
  threadId: string;
  onPosted: () => void;
}) {
  const [body, setBody] = useState('');
  const [preview, setPreview] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ok = body.trim().length > 0 && body.length <= REPLY_MAX;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!ok) return;
    setSubmitting(true);
    setError(null);
    try {
      await createReply(threadId, body);
      setBody('');
      onPosted();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to post reply');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="reply-composer card" onSubmit={submit}>
      <div className="reply-composer-tabs tabs">
        <button
          type="button"
          className={`tab ${!preview ? 'active' : ''}`}
          onClick={() => setPreview(false)}
        >
          Write
        </button>
        <button
          type="button"
          className={`tab ${preview ? 'active' : ''}`}
          onClick={() => setPreview(true)}
        >
          Preview
        </button>
      </div>
      {preview ? (
        <div className="markdown-body reply-composer-preview">
          <ReactMarkdown>{body || '*(nothing to preview)*'}</ReactMarkdown>
        </div>
      ) : (
        <textarea
          className="textarea"
          rows={5}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Share your reply (Markdown supported)"
        />
      )}
      <div className="reply-composer-foot">
        <span className="field-help">{body.length} / {REPLY_MAX}</span>
        {error ? <span className="state state-error">{error}</span> : null}
        <button type="submit" className="btn btn-primary" disabled={!ok || submitting}>
          {submitting ? 'Posting…' : 'Post reply'}
        </button>
      </div>
    </form>
  );
}
