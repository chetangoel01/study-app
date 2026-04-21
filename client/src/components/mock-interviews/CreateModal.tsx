import { useEffect, useMemo, useState } from 'react';
import type { MockPeer, RolePreference } from '../../types.js';

type Mode = 'invite' | 'availability';

interface Props {
  peers: MockPeer[];
  defaultRolePreference: RolePreference;
  onClose: () => void;
  onScheduleInvite: (payload: {
    peerId: string; topic: string; scheduledFor: string; durationMinutes: number; rolePreference: RolePreference;
  }) => Promise<{ id: string }>;
  onPostAvailability: (payload: {
    durationMinutes: number; topic: string; notes: string; rolePreference: RolePreference;
    blocks: Array<{ startsAt: string }>;
  }) => Promise<{ proposalId: string }>;
}

function toLocalInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
function parseLocalInput(v: string): string | null {
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

const ROLE_LABELS: Record<RolePreference, string> = {
  interviewee: 'I want to be interviewed',
  interviewer: 'I want to interview',
  either: 'Either',
};

function RoleSelector({ value, onChange }: { value: RolePreference; onChange: (v: RolePreference) => void }) {
  return (
    <div role="radiogroup" aria-label="Role preference" className="role-selector">
      {(['interviewee', 'interviewer', 'either'] as RolePreference[]).map((role) => (
        <label key={role} className={`role-option${value === role ? ' selected' : ''}`}>
          <input
            type="radio"
            name="role-preference"
            value={role}
            checked={value === role}
            onChange={() => onChange(role)}
          />
          <span>{ROLE_LABELS[role]}</span>
        </label>
      ))}
    </div>
  );
}

export function CreateModal({ peers, defaultRolePreference, onClose, onScheduleInvite, onPostAvailability }: Props) {
  const defaultLocal = useMemo(() => toLocalInput(new Date(Date.now() + 24 * 60 * 60 * 1000)), []);
  const [mode, setMode] = useState<Mode>(peers.length > 0 ? 'invite' : 'availability');
  const [peerId, setPeerId] = useState(peers[0]?.id ?? '');
  const [role, setRole] = useState<RolePreference>(defaultRolePreference);
  const [topic, setTopic] = useState('Systems Design');
  const [duration, setDuration] = useState(45);
  const [scheduledLocal, setScheduledLocal] = useState(defaultLocal);
  const [notes, setNotes] = useState('');
  const [blocks, setBlocks] = useState<string[]>([defaultLocal]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    if (peers.length === 0) { setMode('availability'); setPeerId(''); return; }
    setPeerId((p) => peers.some((x) => x.id === p) ? p : peers[0].id);
  }, [peers]);

  const submitInvite = async () => {
    setError('');
    const iso = parseLocalInput(scheduledLocal);
    if (!peerId) { setError('Pick a peer.'); return; }
    if (!iso) { setError('Pick a valid time.'); return; }
    setSubmitting(true);
    try {
      await onScheduleInvite({ peerId, scheduledFor: iso, durationMinutes: duration, topic: topic.trim() || 'General Technical', rolePreference: role });
      onClose();
    } catch (e: any) {
      setError(e?.message || 'Could not send invite.');
    } finally { setSubmitting(false); }
  };

  const submitAvailability = async () => {
    setError('');
    if (blocks.length < 1 || blocks.length > 8) { setError('Post 1–8 blocks.'); return; }
    const isoBlocks: Array<{ startsAt: string }> = [];
    for (const b of blocks) {
      const iso = parseLocalInput(b);
      if (!iso) { setError('One or more blocks have invalid times.'); return; }
      isoBlocks.push({ startsAt: iso });
    }
    setSubmitting(true);
    try {
      await onPostAvailability({ durationMinutes: duration, topic: topic.trim() || 'General Technical', notes: notes.trim(), rolePreference: role, blocks: isoBlocks });
      onClose();
    } catch (e: any) {
      setError(e?.message || 'Could not post availability.');
    } finally { setSubmitting(false); }
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="create-modal-title"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-panel practice-modal mock-interview-modal" onClick={(e) => e.stopPropagation()}>
        <p className="modal-kicker">Mock Interviews</p>
        <h2 id="create-modal-title" className="modal-title">Find a Peer</h2>

        <div className="mock-modal-tabs" role="tablist" aria-label="Mock interview flow">
          <button type="button" role="tab" aria-selected={mode === 'invite'} disabled={peers.length === 0}
            className={`mock-modal-tab${mode === 'invite' ? ' active' : ''}`} onClick={() => setMode('invite')}>
            Invite a Peer
          </button>
          <button type="button" role="tab" aria-selected={mode === 'availability'}
            className={`mock-modal-tab${mode === 'availability' ? ' active' : ''}`} onClick={() => setMode('availability')}>
            Post availability
          </button>
        </div>

        <label className="field-label">Role preference</label>
        <RoleSelector value={role} onChange={setRole} />

        <label className="field-label" htmlFor="cm-topic">Topic</label>
        <input id="cm-topic" className="practice-input" value={topic} onChange={(e) => setTopic(e.target.value)} />

        <label className="field-label" htmlFor="cm-duration">Duration</label>
        <select id="cm-duration" className="practice-select" value={duration} onChange={(e) => setDuration(Number(e.target.value))}>
          <option value={30}>30 minutes</option>
          <option value={45}>45 minutes</option>
          <option value={60}>60 minutes</option>
          <option value={90}>90 minutes</option>
        </select>

        {mode === 'invite' ? (
          <>
            <label className="field-label">Peer</label>
            <div className="mock-peer-list">
              {peers.map((p) => (
                <label key={p.id} className={`mock-peer-option${peerId === p.id ? ' selected' : ''}`}>
                  <input type="radio" name="peer" value={p.id} checked={peerId === p.id}
                    onChange={(e) => setPeerId(e.target.value)} />
                  <span className="mock-peer-option-avatar">{p.initials}</span>
                  <span className="mock-peer-option-name">{p.fullName}</span>
                </label>
              ))}
            </div>
            <label className="field-label" htmlFor="cm-time">Proposed time</label>
            <input id="cm-time" type="datetime-local" className="practice-input" value={scheduledLocal}
              onChange={(e) => setScheduledLocal(e.target.value)} />
          </>
        ) : (
          <>
            <label className="field-label">Time blocks ({blocks.length})</label>
            <div className="availability-blocks">
              {blocks.map((b, i) => (
                <div key={i} className="availability-block-row">
                  <input type="datetime-local" className="practice-input" value={b}
                    onChange={(e) => setBlocks((bs) => bs.map((x, idx) => idx === i ? e.target.value : x))} />
                  {blocks.length > 1 && (
                    <button type="button" aria-label="Remove block"
                      onClick={() => setBlocks((bs) => bs.filter((_, idx) => idx !== i))}>×</button>
                  )}
                </div>
              ))}
              {blocks.length < 8 && (
                <button type="button" className="secondary-link"
                  onClick={() => setBlocks((bs) => [...bs, defaultLocal])}>+ Add block</button>
              )}
            </div>
            <label className="field-label" htmlFor="cm-notes">Notes</label>
            <textarea id="cm-notes" className="practice-textarea" value={notes}
              onChange={(e) => setNotes(e.target.value)} rows={3} />
          </>
        )}

        {error && <p className="mock-modal-error">{error}</p>}

        <div className="practice-modal-footer">
          <button type="button" className="secondary-link" onClick={onClose} disabled={submitting}>Cancel</button>
          <button type="button" className="primary-action"
            onClick={mode === 'invite' ? submitInvite : submitAvailability}
            disabled={submitting || (mode === 'invite' && peers.length === 0)}>
            {mode === 'invite' ? 'Send invite' : `Post ${blocks.length} block${blocks.length > 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </div>
  );
}
