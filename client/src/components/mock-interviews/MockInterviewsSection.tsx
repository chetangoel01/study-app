import { useState } from 'react';
import { useInvites, useMockInterviewPeers, useInviteDetail } from '../../hooks/useMockInterviews.js';
import { useMyAvailability, useFeed } from '../../hooks/useAvailability.js';
import type { RolePreference } from '../../types.js';
import { CreateModal } from './CreateModal.js';
import { InviteDetailModal } from './InviteDetailModal.js';
import { MyAvailabilityModal } from './MyAvailabilityModal.js';
import { AvailabilityFeedModal } from './AvailabilityFeedModal.js';

interface Props {
  callerId: string;
  defaultRolePreference: RolePreference;
}

export function MockInterviewsSection({ callerId, defaultRolePreference }: Props) {
  const { peers } = useMockInterviewPeers();
  const { invites, schedule, accept, decline, cancel, reschedule, refresh: refreshInvites } = useInvites();
  const { data: myAvailability, create: createAvailability, cancelBlock, cancelProposal, refresh: refreshMine } = useMyAvailability();
  const [roleFilter, setRoleFilter] = useState<'any' | 'interviewee' | 'interviewer'>('any');
  const { blocks: feedBlocks, loading: feedLoading, claim, refresh: refreshFeed } = useFeed({ role: roleFilter });
  const [openDetailId, setOpenDetailId] = useState<string | null>(null);
  const { detail } = useInviteDetail(openDetailId);
  const [openCreate, setOpenCreate] = useState(false);
  const [openMine, setOpenMine] = useState(false);
  const [openFeed, setOpenFeed] = useState(false);

  const received = invites.filter((i) => i.direction === 'received' && i.status === 'pending_acceptance');
  const sent = invites.filter((i) => i.direction === 'sent' && (i.status === 'pending_acceptance' || i.status === 'accepted'));
  const openBlocks = myAvailability.proposals.flatMap((p) => p.blocks.filter((b) => b.status === 'open'));

  return (
    <section className="mock-interviews-section">
      <header><h2>Mock interviews</h2></header>
      <div className="mock-section-grid">
        <article className="mock-card">
          <header>Received invites ({received.length})</header>
          {received.length === 0 && <p>Nothing waiting on you. Claim availability below or send an invite to get started.</p>}
          <ul>
            {received.slice(0, 3).map((inv) => (
              <li key={inv.id}>
                <button type="button" className="secondary-link" onClick={() => setOpenDetailId(inv.id)}>{inv.counterparty.fullName} · {inv.topic} · {new Date(inv.scheduledFor).toLocaleString()}</button>
                <button type="button" onClick={() => accept(inv.id)}>Accept</button>
                <button type="button" onClick={() => decline(inv.id)}>Decline</button>
              </li>
            ))}
          </ul>
        </article>

        <article className="mock-card">
          <header>Sent invites ({sent.length})</header>
          {sent.length === 0 && <p>You haven't sent any invites yet.</p>}
          <ul>
            {sent.slice(0, 3).map((inv) => (
              <li key={inv.id}>
                <button type="button" className="secondary-link" onClick={() => setOpenDetailId(inv.id)}>{inv.counterparty.fullName} · {inv.topic} · {inv.status}</button>
                <button type="button" onClick={() => cancel(inv.id)}>Cancel</button>
              </li>
            ))}
          </ul>
          <button type="button" className="primary-action" onClick={() => setOpenCreate(true)}>Find a peer</button>
        </article>

        <article className="mock-card">
          <header>My availability ({openBlocks.length} open)</header>
          {openBlocks.length === 0 && <p>Post a few time blocks and peers can claim them directly.</p>}
          <ul>
            {openBlocks.slice(0, 3).map((b) => (<li key={b.blockId}>{new Date(b.startsAt).toLocaleString()}</li>))}
          </ul>
          <button type="button" className="primary-action" onClick={() => setOpenCreate(true)}>Post availability</button>
          <button type="button" className="secondary-link" onClick={() => setOpenMine(true)}>View all</button>
        </article>

        <article className="mock-card">
          <header>Open availability feed</header>
          <label>Filter: <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value as 'any' | 'interviewee' | 'interviewer')}>
            <option value="any">Any</option>
            <option value="interviewee">Wants to be interviewed</option>
            <option value="interviewer">Wants to interview</option>
          </select></label>
          {feedBlocks.length === 0 && !feedLoading && <p>No open availability matches your filters. Try widening the role filter.</p>}
          <ul>
            {feedBlocks.slice(0, 5).map((b) => (
              <li key={b.blockId}>
                {b.postedBy.fullName} · {new Date(b.startsAt).toLocaleString()} · {b.rolePreference}
                <button type="button" onClick={() => setOpenFeed(true)}>Claim</button>
              </li>
            ))}
          </ul>
          <button type="button" className="secondary-link" onClick={() => setOpenFeed(true)}>Browse more</button>
        </article>
      </div>

      {openCreate && (
        <CreateModal
          peers={peers}
          defaultRolePreference={defaultRolePreference}
          onClose={() => setOpenCreate(false)}
          onScheduleInvite={async (p) => { const r = await schedule(p); return r; }}
          onPostAvailability={async (p) => { const r = await createAvailability(p); await refreshMine(); return r; }}
        />
      )}
      {openDetailId && detail && (
        <InviteDetailModal
          detail={detail}
          callerId={callerId}
          onClose={() => setOpenDetailId(null)}
          onAction={async (action, args) => {
            if (action === 'accept') await accept(detail.id);
            else if (action === 'decline') await decline(detail.id);
            else if (action === 'cancel') await cancel(detail.id);
            else if (action === 'reschedule' && args?.scheduledFor) await reschedule(detail.id, args.scheduledFor);
            setOpenDetailId(null);
          }}
        />
      )}
      {openMine && (
        <MyAvailabilityModal
          data={myAvailability}
          onClose={() => setOpenMine(false)}
          onCancelBlock={cancelBlock}
          onCancelProposal={cancelProposal}
          onPostMore={() => { setOpenMine(false); setOpenCreate(true); }}
        />
      )}
      {openFeed && (
        <AvailabilityFeedModal
          blocks={feedBlocks}
          loading={feedLoading}
          roleFilter={roleFilter}
          onRoleFilterChange={setRoleFilter}
          onClose={() => { setOpenFeed(false); refreshFeed(); refreshInvites(); }}
          onClaim={async (blockId, role, notes) => { await claim(blockId, role, notes); await refreshInvites(); }}
        />
      )}
    </section>
  );
}
