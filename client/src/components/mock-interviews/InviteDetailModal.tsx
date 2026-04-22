import { useEffect } from 'react';
import type { InviteDetail } from '../../types.js';
import { formatInZone } from '../../lib/scheduling-dates.js';

type InviteAction = 'accept' | 'decline' | 'cancel' | 'reschedule';

interface Props {
  detail: InviteDetail;
  callerId: string;
  userTimezone: string;
  onClose: () => void;
  onAction: (action: InviteAction, args?: { scheduledFor?: string }) => Promise<void>;
}

function eventLabel(e: InviteDetail['events'][number], tz: string): string {
  switch (e.eventType) {
    case 'created': return 'Invite created';
    case 'accepted': return 'Accepted';
    case 'declined': return 'Declined';
    case 'cancelled': return 'Cancelled';
    case 'rescheduled': {
      const p = e.payload as { from?: string; to?: string } | null;
      return p?.from && p?.to ? `Rescheduled from ${formatInZone(p.from, tz)} to ${formatInZone(p.to, tz)}` : 'Rescheduled';
    }
    default: return e.eventType;
  }
}

export function InviteDetailModal({ detail, callerId, userTimezone, onClose, onAction }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const isPeer = detail.direction === 'received';
  const isPending = detail.status === 'pending_acceptance';
  const isAccepted = detail.status === 'accepted';
  const isPreTerminal = isPending || isAccepted;

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-panel practice-modal" onClick={(e) => e.stopPropagation()}>
        <h2 className="modal-title">{detail.topic || 'Mock interview'}</h2>
        <p className="modal-body">
          With {detail.counterparty.fullName} · {formatInZone(detail.scheduledFor, userTimezone)} · {detail.durationMinutes} min · status: {detail.status}
          {detail.sourceBlockId && <> · from {detail.counterparty.fullName}'s posted availability</>}
        </p>

        <div className="invite-actions">
          {isPeer && isPending && (
            <>
              <button type="button" className="primary-action" onClick={() => onAction('accept')}>Accept</button>
              <button type="button" className="secondary-link" onClick={() => onAction('decline')}>Decline</button>
            </>
          )}
          {isPreTerminal && (
            <button type="button" className="secondary-link" onClick={() => onAction('cancel')}>Cancel</button>
          )}
          {isPreTerminal && (
            <button type="button" className="secondary-link" onClick={() => {
              const v = window.prompt('New time (ISO):', detail.scheduledFor);
              if (v) onAction('reschedule', { scheduledFor: v });
            }}>Reschedule</button>
          )}
        </div>

        <h3>Timeline</h3>
        <ul className="invite-timeline" aria-label="timeline">
          {detail.events.map((e) => (
            <li key={e.id}>
              <span className="timeline-when">{formatInZone(e.createdAt, userTimezone)}</span>
              <span className="timeline-what">{eventLabel(e, userTimezone)}</span>
              <span className="timeline-who">{e.actorId === callerId ? 'you' : detail.counterparty.fullName}</span>
            </li>
          ))}
        </ul>

        <div className="practice-modal-footer">
          <button type="button" className="secondary-link" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
