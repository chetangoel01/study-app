import ReactMarkdown from 'react-markdown';

interface Props {
  content: string;
  loading?: boolean;
  error?: string;
  fallbackUrl?: string;
  fallbackLabel?: string;
}

export function MarkdownRenderer({
  content,
  loading = false,
  error = '',
  fallbackUrl,
  fallbackLabel,
}: Props) {
  if (loading) {
    return <div className="markdown-loading">Loading content...</div>;
  }

  if (error) {
    if (fallbackUrl) {
      return (
        <a
          href={fallbackUrl}
          target="_blank"
          rel="noreferrer"
          className="fallback-link"
        >
          {fallbackLabel ?? 'Open in new tab ->'}
        </a>
      );
    }
    return <p className="markdown-empty">{error}</p>;
  }

  if (!content) {
    if (fallbackUrl) {
      return (
        <a
          href={fallbackUrl}
          target="_blank"
          rel="noreferrer"
          className="fallback-link"
        >
          {fallbackLabel ?? 'Open in new tab ->'}
        </a>
      );
    }
    return (
      <p className="markdown-empty">
        Content not yet generated - run the enrichment pipeline and restart the server.
      </p>
    );
  }

  return <ReactMarkdown className="markdown-body">{content}</ReactMarkdown>;
}
