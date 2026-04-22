import { useEffect, useMemo, useState } from 'react';
import type { FeedBlock, RolePreference } from '../../types.js';
import { formatInZone } from '../../lib/scheduling-dates.js';

interface Props {
  blocks: FeedBlock[];
  loading: boolean;
  roleFilter: 'any' | 'interviewee' | 'interviewer';
  userTimezone: string;
  onRoleFilterChange: (v: 'any' | 'interviewee' | 'interviewer') => void;
  onClose: () => void;
  onClaim: (blockId: string, rolePreference: RolePreference, notes?: string) => Promise<void>;
}

export function AvailabilityFeedModal({ blocks, loading, roleFilter, userTimezone, onRoleFilterChange, onClose, onClaim }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const grouped = useMemo(() => {
    const byUser = new Map<string, FeedBlock[]>();
    for (const b of blocks) {
      const list = byUser.get(b.postedBy.id) ?? [];
      list.push(b);
      byUser.set(b.postedBy.id, list);
    }
    return Array.from(byUser.entries());
  }, [blocks]);

  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [claimRole, setClaimRole] = useState<RolePreference>('either');
  const [claimNotes, setClaimNotes] = useState('');

  async function confirmClaim(blockId: string) {
    await onClaim(blockId, claimRole, claimNotes || undefined);
    setClaimingId(null);
    setClaimNotes('');
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="feed-modal-title"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-panel practice-modal" onClick={(e) => e.stopPropagation()}>
        <h2 id="feed-modal-title" className="modal-title">Open availability</h2>

        <label className="field-label" htmlFor="feed-role">Role filter</label>
        <select id="feed-role" className="practice-select" value={roleFilter}
          onChange={(e) => onRoleFilterChange(e.target.value as any)}>
          <option value="any">Any</option>
          <option value="interviewee">Wants to be interviewed</option>
          <option value="interviewer">Wants to interview</option>
        </select>

        {loading && <p className="modal-body">Loading…</p>}
        {!loading && blocks.length === 0 && (
          <p className="modal-body">No open availability matches your filters. Try widening the role filter.</p>
        )}

        {grouped.map(([userId, items]) => (
          <section key={userId} className="feed-group">
            <header><strong>{items[0].postedBy.fullName}</strong> · {items.length} block(s)</header>
            <ul>
              {items.map((b) => (
                <li key={b.blockId} className="feed-block-row">
                  <span>{formatInZone(b.startsAt, userTimezone)}</span>
                  <span>{b.durationMinutes} min</span>
                  <span>role: {b.rolePreference}</span>
                  {claimingId === b.blockId ? (
                    <span className="claim-confirm">
                      Your role:
                      <select value={claimRole} onChange={(e) => setClaimRole(e.target.value as RolePreference)}>
                        <option value="interviewee">Interviewee</option>
                        <option value="interviewer">Interviewer</option>
                        <option value="either">Either</option>
                      </select>
                      <input type="text" placeholder="Notes (optional)" value={claimNotes}
                        onChange={(e) => setClaimNotes(e.target.value)} />
                      <button type="button" className="primary-action" onClick={() => confirmClaim(b.blockId)}>Confirm</button>
                      <button type="button" className="secondary-link" onClick={() => setClaimingId(null)}>Cancel</button>
                    </span>
                  ) : (
                    <button type="button" className="primary-action" onClick={() => setClaimingId(b.blockId)}>Claim</button>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))}

        <div className="practice-modal-footer">
          <button type="button" className="secondary-link" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
