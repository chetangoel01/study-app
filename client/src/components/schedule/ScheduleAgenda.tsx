import type { InviteSummary } from '../../types.js';
import { groupByDay } from '../../lib/scheduling-dates.js';
import { ScheduleEventCard } from './ScheduleEventCard.js';

interface Props {
  invites: InviteSummary[];
  tz: string;
  showPast: boolean;
  onAction: (action: 'accept' | 'decline' | 'cancel' | 'reschedule', inviteId: string) => void;
  onOpenDetail: (inviteId: string) => void;
}

export function ScheduleAgenda({ invites, tz, showPast, onAction, onOpenDetail }: Props) {
  if (invites.length === 0) {
    return (
      <div className="schedule-empty">
        {showPast
          ? 'No past interviews in the last 30 days.'
          : 'No upcoming mock interviews. Head to Practice to find a peer.'}
      </div>
    );
  }

  const groups = groupByDay(invites, tz);

  return (
    <div className="schedule-agenda">
      {groups.map((group) => (
        <section key={group.dayKey} className="schedule-day">
          <h2 className="schedule-day-heading">{group.label}</h2>
          <div className="schedule-day-items">
            {group.items.map((invite) => (
              <ScheduleEventCard
                key={invite.id}
                invite={invite}
                tz={tz}
                onAction={onAction}
                onOpenDetail={onOpenDetail}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
