import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useInvites, useMockInterviewPeers, useInviteDetail } from '../../hooks/useMockInterviews.js';
import { useMyAvailability, useFeed } from '../../hooks/useAvailability.js';
import type { RolePreference } from '../../types.js';
import { formatInZone } from '../../lib/scheduling-dates.js';
import { CreateModal } from './CreateModal.js';
import { InviteDetailModal } from './InviteDetailModal.js';
import { MyAvailabilityModal } from './MyAvailabilityModal.js';
import { AvailabilityFeedModal } from './AvailabilityFeedModal.js';

interface Props {
  callerId: string;
  defaultRolePreference: RolePreference;
  userTimezone: string;
}

export function MockInterviewsSection({ callerId, defaultRolePreference, userTimezone }: Props) {
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
    <section className="mock-interviews-section practice-category-card mock-hero-card">
      <div className="category-icon-bg mock-bg">
        <div className="category-icon mock-icon" aria-hidden="true">
          <svg width="56" height="56" viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="56" height="56" rx="16" fill="#E1C4F3" />
            <path d="M14 20.5C14 18.0147 16.0147 16 18.5 16H30.5C32.9853 16 35 18.0147 35 20.5V27C35 29.4853 32.9853 31.5 30.5 31.5H24L19.5 35.5V31.5H18.5C16.0147 31.5 14 29.4853 14 27V20.5Z" fill="#6D567E" />
            <path d="M22 27.5C22 24.4624 24.4624 22 27.5 22H37.5C40.5376 22 43 24.4624 43 27.5V34C43 37.0376 40.5376 39.5 37.5 39.5H36.5V44L31.5 39.5H27.5C24.4624 39.5 22 37.0376 22 34V27.5Z" fill="#FAF8FF" stroke="#6D567E" strokeWidth="1.5" />
            <circle cx="30" cy="31" r="1.2" fill="#6D567E" />
            <circle cx="34" cy="31" r="1.2" fill="#6D567E" />
            <circle cx="38" cy="31" r="1.2" fill="#6D567E" />
          </svg>
        </div>
      </div>
      <h3>Mock Interviews</h3>
      <p>Schedule live practice with peers or claim an open slot from the feed.</p>

      <div className="mock-lanes">
        <div className="mock-lane mock-lane--primary">
          <div className="mock-lane-head">
            <span className="mock-lane-eyebrow">Received invites</span>
            <span className="mock-lane-pip">{received.length}</span>
          </div>
          {received.length === 0 ? (
            <p className="mock-lane-empty">Nothing waiting on you. Claim availability or send an invite to get started.</p>
          ) : (
            <ul className="mock-lane-list">
              {received.slice(0, 2).map((inv) => (
                <li key={inv.id} className="mock-lane-item">
                  <button type="button" className="mock-lane-link" onClick={() => setOpenDetailId(inv.id)}>
                    <span className="mock-lane-primary">{inv.counterparty.fullName}</span>
                    <span className="mock-lane-secondary">{inv.topic} · {formatInZone(inv.scheduledFor, userTimezone)}</span>
                  </button>
                  <div className="mock-lane-actions">
                    <button type="button" className="mock-chip mock-chip--primary" onClick={() => accept(inv.id)}>Accept</button>
                    <button type="button" className="mock-chip" onClick={() => decline(inv.id)}>Decline</button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="mock-lane-pair">
          <div className="mock-lane">
            <div className="mock-lane-head">
              <span className="mock-lane-eyebrow">Sent invites</span>
              <span className="mock-lane-pip">{sent.length}</span>
            </div>
            {sent.length === 0 ? (
              <p className="mock-lane-empty">You haven't sent any invites yet.</p>
            ) : (
              <ul className="mock-lane-list">
                {sent.slice(0, 1).map((inv) => (
                  <li key={inv.id} className="mock-lane-item mock-lane-item--compact">
                    <button type="button" className="mock-lane-link" onClick={() => setOpenDetailId(inv.id)}>
                      <span className="mock-lane-primary">{inv.counterparty.fullName}</span>
                      <span className="mock-lane-secondary">{inv.status.replace(/_/g, ' ')}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="mock-lane">
            <div className="mock-lane-head">
              <span className="mock-lane-eyebrow">Your slots</span>
              <span className="mock-lane-pip">{openBlocks.length}</span>
            </div>
            {openBlocks.length === 0 ? (
              <p className="mock-lane-empty">Post a few time blocks and peers can claim them.</p>
            ) : (
              <ul className="mock-lane-list">
                {openBlocks.slice(0, 1).map((b) => (
                  <li key={b.blockId} className="mock-lane-item mock-lane-item--compact">
                    <span className="mock-lane-primary">{formatInZone(b.startsAt, userTimezone)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="mock-lane">
          <div className="mock-lane-head">
            <span className="mock-lane-eyebrow">Open availability</span>
            <select
              className="mock-lane-filter"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as 'any' | 'interviewee' | 'interviewer')}
              aria-label="Filter availability by role"
            >
              <option value="any">Any role</option>
              <option value="interviewee">Interviewees</option>
              <option value="interviewer">Interviewers</option>
            </select>
          </div>
          {feedBlocks.length === 0 && !feedLoading ? (
            <p className="mock-lane-empty">No open availability matches your filter. Try widening the role filter.</p>
          ) : (
            <ul className="mock-lane-list">
              {feedBlocks.slice(0, 3).map((b) => (
                <li key={b.blockId} className="mock-lane-item mock-lane-item--feed">
                  <span className="mock-feed-dot" aria-hidden="true" />
                  <div className="mock-lane-link mock-lane-link--static">
                    <span className="mock-lane-primary">{b.postedBy.fullName}</span>
                    <span className="mock-lane-secondary">{formatInZone(b.startsAt, userTimezone)} · {b.rolePreference}</span>
                  </div>
                  <button type="button" className="mock-chip" onClick={() => setOpenFeed(true)}>Claim</button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="mock-card-footer">
        <button type="button" className="category-btn mock-btn mock-btn--lead" onClick={() => setOpenCreate(true)}>
          Find a peer <span className="btn-arrow">→</span>
        </button>
        <div className="mock-ghost-actions">
          <button type="button" className="mock-ghost" onClick={() => setOpenMine(true)}>Manage slots</button>
          <button type="button" className="mock-ghost" onClick={() => setOpenFeed(true)}>Browse feed</button>
          <Link to="/schedule" className="mock-ghost">View full schedule →</Link>
        </div>
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
          userTimezone={userTimezone}
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
          userTimezone={userTimezone}
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
          userTimezone={userTimezone}
          onRoleFilterChange={setRoleFilter}
          onClose={() => { setOpenFeed(false); refreshFeed(); refreshInvites(); }}
          onClaim={async (blockId, role, notes) => { await claim(blockId, role, notes); await refreshInvites(); }}
        />
      )}
    </section>
  );
}
