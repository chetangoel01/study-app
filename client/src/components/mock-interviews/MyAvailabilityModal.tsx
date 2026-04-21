import { useEffect } from 'react';
import type { MyAvailability } from '../../types.js';

interface Props {
  data: MyAvailability;
  onClose: () => void;
  onCancelBlock: (blockId: string) => Promise<void>;
  onCancelProposal: (proposalId: string) => Promise<void>;
  onPostMore: () => void;
}

function fmt(iso: string): string { return new Date(iso).toLocaleString(); }

export function MyAvailabilityModal({ data, onClose, onCancelBlock, onCancelProposal, onPostMore }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const hasAny = data.proposals.some((p) => p.blocks.length > 0);

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="my-availability-title"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-panel practice-modal" onClick={(e) => e.stopPropagation()}>
        <h2 id="my-availability-title" className="modal-title">Your availability</h2>
        {!hasAny && (
          <p className="modal-body">Post a few time blocks and peers can claim them directly.</p>
        )}
        {data.proposals.map((p) => (
          <section key={p.id} className="availability-proposal-section">
            <header>
              <strong>{p.topic || 'General'}</strong> · {p.durationMinutes} min · role: {p.rolePreference}
              <button type="button" className="secondary-link" onClick={() => onCancelProposal(p.id)}>Cancel all open</button>
            </header>
            <ul>
              {p.blocks.map((b) => (
                <li key={b.blockId} className={`availability-block availability-block--${b.status}`}>
                  <span>{fmt(b.startsAt)}</span>
                  <span>status: {b.status}</span>
                  {b.status === 'open' && (
                    <button type="button" className="secondary-link" onClick={() => onCancelBlock(b.blockId)}>Cancel</button>
                  )}
                  {b.status === 'claimed' && b.claimedBy && (
                    <span>claimed by {b.claimedBy.fullName}</span>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))}

        <div className="practice-modal-footer">
          <button type="button" className="secondary-link" onClick={onClose}>Close</button>
          <button type="button" className="primary-action" onClick={onPostMore}>Post more blocks</button>
        </div>
      </div>
    </div>
  );
}
