import type { CommunityAuthor } from '../types.js';

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

function relativeTime(iso: string): string {
  const ts = Date.parse(iso);
  if (!Number.isFinite(ts)) return '';
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

export function AuthorChip({
  author,
  timestamp,
  editedAt,
}: {
  author: CommunityAuthor | null;
  timestamp: string;
  editedAt?: string | null;
}) {
  const name = author?.name ?? 'Unknown';
  return (
    <span className="author-chip">
      <span className="author-chip-avatar" aria-hidden="true">{initials(name)}</span>
      <span className="author-chip-meta">
        <span className="author-chip-name">{name}</span>
        <span className="author-chip-time">
          {relativeTime(timestamp)}
          {editedAt ? <span className="author-chip-edited"> · edited</span> : null}
        </span>
      </span>
    </span>
  );
}
