import { useEffect, useMemo, useState } from 'react';
import type { MockPeer } from '../types.js';

type MockFlowMode = 'invite' | 'availability';

interface SchedulePayload {
  peerId: string;
  topic: string;
  scheduledFor: string;
}

interface AvailabilityPayload {
  proposedFor: string;
  durationMinutes: number;
  topic: string;
  notes: string;
}

interface Props {
  peers: MockPeer[];
  onClose: () => void;
  onSchedule: (payload: SchedulePayload) => Promise<void>;
  onProposeAvailability: (payload: AvailabilityPayload) => Promise<void>;
}

function toLocalDateTimeInputValue(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function parseLocalDateTimeToIso(value: string): string | null {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

export function MockInterviewModal({ peers, onClose, onSchedule, onProposeAvailability }: Props) {
  const defaultLocalTime = useMemo(
    () => toLocalDateTimeInputValue(new Date(Date.now() + 24 * 60 * 60 * 1000)),
    [],
  );
  const [mode, setMode] = useState<MockFlowMode>(peers.length > 0 ? 'invite' : 'availability');
  const [selectedPeerId, setSelectedPeerId] = useState(peers[0]?.id ?? '');
  const [topic, setTopic] = useState('Systems Design');
  const [scheduledForLocal, setScheduledForLocal] = useState(defaultLocalTime);
  const [durationMinutes, setDurationMinutes] = useState(45);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    if (peers.length === 0) {
      setMode('availability');
      setSelectedPeerId('');
      return;
    }

    setSelectedPeerId((current) => {
      if (peers.some((peer) => peer.id === current)) return current;
      return peers[0].id;
    });
  }, [peers]);

  const handleInvite = async () => {
    setError('');
    if (!selectedPeerId) {
      setError('Pick a peer before sending an invite.');
      return;
    }
    const scheduledFor = parseLocalDateTimeToIso(scheduledForLocal);
    if (!scheduledFor) {
      setError('Pick a valid date and time.');
      return;
    }

    setSubmitting(true);
    try {
      await onSchedule({
        peerId: selectedPeerId,
        topic: topic.trim() || 'General Technical',
        scheduledFor,
      });
      onClose();
    } catch {
      setError('Could not send invite. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAvailabilityProposal = async () => {
    setError('');
    const proposedFor = parseLocalDateTimeToIso(scheduledForLocal);
    if (!proposedFor) {
      setError('Pick a valid date and time.');
      return;
    }

    setSubmitting(true);
    try {
      await onProposeAvailability({
        proposedFor,
        durationMinutes,
        topic: topic.trim() || 'General Technical',
        notes: notes.trim(),
      });
      onClose();
    } catch {
      setError('Could not submit availability. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="mock-interview-modal-title"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="modal-panel practice-modal mock-interview-modal" onClick={(event) => event.stopPropagation()}>
        <p className="modal-kicker">Mock Interviews</p>
        <h2 id="mock-interview-modal-title" className="modal-title">Find a Peer</h2>
        <p className="modal-body">
          Invite a specific peer or propose your availability and let people match with you.
        </p>

        <div className="mock-modal-tabs" role="tablist" aria-label="Mock interview flow">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'invite'}
            disabled={peers.length === 0}
            className={`mock-modal-tab${mode === 'invite' ? ' active' : ''}`}
            onClick={() => setMode('invite')}
          >
            Invite a Peer
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'availability'}
            className={`mock-modal-tab${mode === 'availability' ? ' active' : ''}`}
            onClick={() => setMode('availability')}
          >
            Propose Availability
          </button>
        </div>

        {mode === 'invite' ? (
          <div className="practice-form">
            <label className="field-label">Available Peers</label>
            <div className="mock-peer-list">
              {peers.map((peer) => (
                <label key={peer.id} className={`mock-peer-option${selectedPeerId === peer.id ? ' selected' : ''}`}>
                  <input
                    type="radio"
                    name="mock-peer"
                    value={peer.id}
                    checked={selectedPeerId === peer.id}
                    onChange={(event) => setSelectedPeerId(event.target.value)}
                  />
                  <span className="mock-peer-option-avatar">{peer.initials}</span>
                  <span className="mock-peer-option-copy">
                    <span className="mock-peer-option-name">{peer.fullName}</span>
                  </span>
                </label>
              ))}
            </div>

            <label className="field-label" htmlFor="mock-topic-input">Topic</label>
            <input
              id="mock-topic-input"
              className="practice-input"
              value={topic}
              onChange={(event) => setTopic(event.target.value)}
              placeholder="Systems Design"
            />

            <label className="field-label" htmlFor="mock-time-input">Proposed Time</label>
            <input
              id="mock-time-input"
              type="datetime-local"
              className="practice-input"
              value={scheduledForLocal}
              onChange={(event) => setScheduledForLocal(event.target.value)}
            />
          </div>
        ) : (
          <div className="practice-form">
            <label className="field-label" htmlFor="availability-time-input">Available At</label>
            <input
              id="availability-time-input"
              type="datetime-local"
              className="practice-input"
              value={scheduledForLocal}
              onChange={(event) => setScheduledForLocal(event.target.value)}
            />

            <label className="field-label" htmlFor="availability-duration">Duration</label>
            <select
              id="availability-duration"
              className="practice-select"
              value={durationMinutes}
              onChange={(event) => setDurationMinutes(Number(event.target.value))}
            >
              <option value={30}>30 minutes</option>
              <option value={45}>45 minutes</option>
              <option value={60}>60 minutes</option>
              <option value={90}>90 minutes</option>
            </select>

            <label className="field-label" htmlFor="availability-topic">Topic Focus</label>
            <input
              id="availability-topic"
              className="practice-input"
              value={topic}
              onChange={(event) => setTopic(event.target.value)}
              placeholder="General Technical"
            />

            <label className="field-label" htmlFor="availability-notes">Notes (optional)</label>
            <textarea
              id="availability-notes"
              className="practice-textarea"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Mention stack, role, or interview focus."
              rows={3}
            />
          </div>
        )}

        {error ? <p className="mock-modal-error">{error}</p> : null}

        <div className="practice-modal-footer">
          <button type="button" className="secondary-link" onClick={onClose} disabled={submitting}>
            Cancel
          </button>
          <button
            type="button"
            className="primary-action"
            onClick={mode === 'invite' ? handleInvite : handleAvailabilityProposal}
            disabled={submitting || (mode === 'invite' && peers.length === 0)}
          >
            {mode === 'invite' ? 'Send Invite' : 'Post Availability'}
          </button>
        </div>
      </div>
    </div>
  );
}
