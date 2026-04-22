import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import type { AppOutletContext } from '../outletContext.js';
import { useSchedule } from '../hooks/useSchedule.js';
import { ScheduleAgenda } from '../components/schedule/ScheduleAgenda.js';
import { api } from '../api/client.js';
import { InviteDetailModal } from '../components/mock-interviews/InviteDetailModal.js';
import { useInviteDetail } from '../hooks/useMockInterviews.js';

export function SchedulePage() {
  const { user } = useOutletContext<AppOutletContext>();
  const [showPast, setShowPast] = useState(false);
  const { invites, loading, error, refresh, accept, decline, cancel, reschedule } = useSchedule({ showPast });
  const [detailId, setDetailId] = useState<string | null>(null);
  const { detail } = useInviteDetail(detailId);
  const [rescheduling, setRescheduling] = useState<string | null>(null);
  const [nudgeDismissed, setNudgeDismissed] = useState(false);

  const browserZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const showNudge = user.timezone === 'UTC' && !nudgeDismissed && browserZone !== 'UTC';

  async function applyBrowserZone() {
    await api.put('/api/user/profile', { timezone: browserZone });
    window.location.reload();
  }

  async function handleAction(action: 'accept' | 'decline' | 'cancel' | 'reschedule', id: string) {
    if (action === 'reschedule') { setRescheduling(id); return; }
    if (action === 'accept') return accept(id);
    if (action === 'decline') return decline(id);
    if (action === 'cancel') return cancel(id);
  }

  async function handleReschedule(id: string, scheduledFor: string) {
    await reschedule(id, scheduledFor);
    setRescheduling(null);
  }

  return (
    <div className="schedule-page">
      <header className="schedule-header">
        <h1>Your schedule</h1>
        <button
          type="button"
          className="schedule-toggle"
          aria-pressed={showPast}
          onClick={() => setShowPast((p) => !p)}
        >
          {showPast ? 'Hide past' : 'Show past'}
        </button>
      </header>

      {showNudge && (
        <div className="schedule-tz-nudge" role="status">
          Times are shown in UTC. Use your detected zone (<strong>{browserZone}</strong>)?
          <button type="button" className="schedule-btn schedule-btn--primary" onClick={applyBrowserZone}>
            Use {browserZone}
          </button>
          <button type="button" className="schedule-btn" onClick={() => setNudgeDismissed(true)}>
            Not now
          </button>
        </div>
      )}

      {error && <div className="schedule-error" role="alert">{error} <button onClick={refresh}>Retry</button></div>}
      {loading ? (
        <div className="schedule-loading">Loading…</div>
      ) : (
        <ScheduleAgenda
          invites={invites}
          tz={user.timezone}
          showPast={showPast}
          onAction={handleAction}
          onOpenDetail={setDetailId}
        />
      )}

      {detailId && detail && (
        <InviteDetailModal
          detail={detail}
          callerId={String(user.id)}
          userTimezone={user.timezone}
          onClose={() => setDetailId(null)}
          onAction={async (action, args) => {
            if (action === 'accept') await accept(detail.id);
            else if (action === 'decline') await decline(detail.id);
            else if (action === 'cancel') await cancel(detail.id);
            else if (action === 'reschedule' && args?.scheduledFor) await reschedule(detail.id, args.scheduledFor);
            setDetailId(null);
          }}
        />
      )}

      {rescheduling && (
        <RescheduleDialog
          inviteId={rescheduling}
          tz={user.timezone}
          onClose={() => setRescheduling(null)}
          onSubmit={handleReschedule}
        />
      )}
    </div>
  );
}

function RescheduleDialog({
  inviteId, tz, onClose, onSubmit,
}: { inviteId: string; tz: string; onClose: () => void; onSubmit: (id: string, iso: string) => Promise<void> }) {
  const [value, setValue] = useState('');
  return (
    <div className="modal-backdrop" role="dialog" aria-label="Reschedule">
      <div className="modal">
        <h2>Reschedule</h2>
        <p>Times below are local to your browser. Stored time will match your set zone ({tz}).</p>
        <input type="datetime-local" value={value} onChange={(e) => setValue(e.target.value)} />
        <div className="modal-actions">
          <button type="button" onClick={onClose}>Cancel</button>
          <button
            type="button"
            disabled={!value}
            onClick={() => onSubmit(inviteId, new Date(value).toISOString())}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
