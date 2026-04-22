import type { InviteSummary } from '../../types.js';
import { formatInZone } from '../../lib/scheduling-dates.js';

type Action = 'accept' | 'decline' | 'cancel' | 'reschedule';

interface Props {
  invite: InviteSummary;
  tz: string;
  onAction: (action: Action, inviteId: string) => void;
  onOpenDetail: (inviteId: string) => void;
}

export function ScheduleEventCard({ invite, tz, onAction, onOpenDetail }: Props) {
  const isAccepted = invite.status === 'accepted';
  const isReceivedPending = invite.status === 'pending_acceptance' && invite.direction === 'received';
  const isSentPending = invite.status === 'pending_acceptance' && invite.direction === 'sent';

  return (
    <article className="schedule-event-card">
      <div className="schedule-event-time">{formatInZone(invite.scheduledFor, tz)}</div>
      <div className="schedule-event-body">
        <div className="schedule-event-counterparty">
          <span className="schedule-event-avatar" aria-hidden="true">{invite.counterparty.initials}</span>
          <span className="schedule-event-name">{invite.counterparty.fullName}</span>
        </div>
        <div className="schedule-event-meta">
          <span className={`schedule-event-status schedule-event-status--${invite.status}`}>
            {isAccepted ? 'Confirmed' : 'Pending'}
          </span>
          <span className="schedule-event-topic">{invite.topic}</span>
          <span className="schedule-event-duration">{invite.durationMinutes} min</span>
        </div>
      </div>
      <div className="schedule-event-actions">
        {isReceivedPending && (
          <>
            <button type="button" className="schedule-btn schedule-btn--primary" onClick={() => onAction('accept', invite.id)}>Accept</button>
            <button type="button" className="schedule-btn" onClick={() => onAction('decline', invite.id)}>Decline</button>
          </>
        )}
        {isSentPending && (
          <button type="button" className="schedule-btn" onClick={() => onAction('cancel', invite.id)}>Cancel</button>
        )}
        {isAccepted && (
          <>
            <a
              className="schedule-btn schedule-btn--primary"
              href={`/api/schedule/ics/${invite.id}`}
              download={`mock-interview-${invite.id}.ics`}
            >
              Add to calendar
            </a>
            <button type="button" className="schedule-btn" onClick={() => onAction('cancel', invite.id)}>Cancel</button>
          </>
        )}
        <button type="button" className="schedule-btn" onClick={() => onAction('reschedule', invite.id)}>Reschedule</button>
        <button type="button" className="schedule-btn schedule-btn--ghost" onClick={() => onOpenDetail(invite.id)}>Details</button>
      </div>
    </article>
  );
}
