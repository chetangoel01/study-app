import { useEffect } from 'react';

interface Props {
  url: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ExternalLinkModal({ url, onConfirm, onCancel }: Props) {
  let domain = url;
  try {
    domain = new URL(url).hostname.replace(/^www\./, '');
  } catch {
    // Keep the raw URL when parsing fails.
  }

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel();
    };

    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onCancel]);

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ext-link-title"
      onClick={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <div className="modal-panel" onClick={(event) => event.stopPropagation()}>
        <p className="modal-kicker">External resource</p>
        <h2 id="ext-link-title" className="modal-title">Leaving Mindful Engineer</h2>
        <p className="modal-body">
          You&apos;re heading to official documentation on <strong>{domain}</strong>.
          Stay focused and come back when you&apos;re ready to practice.
        </p>
        <div className="modal-actions">
          <a
            href={url}
            target="_blank"
            rel="noreferrer noopener"
            className="primary-action"
            onClick={onConfirm}
          >
            Open in New Tab ↗
          </a>
          <button type="button" className="secondary-link" onClick={onCancel}>
            Stay Here
          </button>
        </div>
        <p className="modal-meta">{url.length > 60 ? `${url.slice(0, 57)}…` : url}</p>
      </div>
    </div>
  );
}
