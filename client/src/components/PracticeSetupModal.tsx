import { useEffect, useState } from 'react';

type Difficulty = 'Easy' | 'Medium' | 'Hard';

export interface PracticeModuleOption {
  moduleId: string;
  title: string;
  trackId: string;
  trackLabel: string;
}

interface Props {
  tracks: { id: string; label: string }[];
  moduleOptions: PracticeModuleOption[];
  onBegin: (config: {
    moduleId: string;
    trackId: string;
    difficulty: Difficulty;
    duration: number;
  }) => void;
  onClose: () => void;
}

export function PracticeSetupModal({ tracks, moduleOptions, onBegin, onClose }: Props) {
  const [trackId, setTrackId] = useState(tracks[0]?.id ?? '');
  const [moduleId, setModuleId] = useState('');
  const [difficulty, setDifficulty] = useState<Difficulty>('Medium');
  const [duration, setDuration] = useState(45);

  const availableModules = moduleOptions.filter((m) => m.trackId === trackId);

  useEffect(() => {
    if (availableModules.length > 0 && !availableModules.some(m => m.moduleId === moduleId)) {
      setModuleId(availableModules[0].moduleId);
    }
  }, [trackId, availableModules, moduleId]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    setModuleId((current) => {
      if (moduleOptions.some((option) => option.moduleId === current)) {
        return current;
      }
      return moduleOptions[0]?.moduleId ?? '';
    });
  }, [moduleOptions]);

  const handleBegin = () => {
    const selectedModule = moduleOptions.find((option) => option.moduleId === moduleId);
    if (!selectedModule) return;

    onBegin({
      moduleId: selectedModule.moduleId,
      trackId: selectedModule.trackId,
      difficulty,
      duration,
    });
    onClose();
  };

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="practice-setup-title"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="modal-panel practice-modal" onClick={(event) => event.stopPropagation()}>
        <p className="modal-kicker">Deep Work</p>
        <h2 id="practice-setup-title" className="modal-title">Configure Practice Session</h2>
        <p className="modal-body">
          Pick a live module, tune the session difficulty, and jump straight into a deliberate practice block.
        </p>

        <div className="practice-form">
          <label className="field-label" htmlFor="practice-track">Study Track</label>
          <select
            id="practice-track"
            className="practice-select"
            value={trackId}
            onChange={(event) => setTrackId(event.target.value)}
          >
            {tracks.map((track) => (
              <option key={track.id} value={track.id}>
                {track.label}
              </option>
            ))}
          </select>

          <label className="field-label" htmlFor="practice-topic" style={{ marginTop: 'var(--sp-4)' }}>Focus Module</label>
          <select
            id="practice-topic"
            className="practice-select"
            value={moduleId}
            onChange={(event) => setModuleId(event.target.value)}
            disabled={availableModules.length === 0}
          >
            {availableModules.map((entry) => (
              <option key={entry.moduleId} value={entry.moduleId}>
                {entry.title}
              </option>
            ))}
          </select>

          <fieldset className="practice-difficulty-group">
            <legend className="field-label">Difficulty</legend>
            <div className="practice-difficulty-pills">
              {(['Easy', 'Medium', 'Hard'] as Difficulty[]).map((entry) => (
                <button
                  key={entry}
                  type="button"
                  className={`practice-difficulty-pill${difficulty === entry ? ' active' : ''}`}
                  aria-pressed={difficulty === entry}
                  onClick={() => setDifficulty(entry)}
                >
                  {entry}
                </button>
              ))}
            </div>
          </fieldset>

          <div>
            <label className="field-label" htmlFor="practice-duration">
              Duration
              <span className="field-duration-value">{duration} Minutes</span>
            </label>
            <input
              id="practice-duration"
              type="range"
              min={15}
              max={90}
              step={15}
              value={duration}
              onChange={(event) => setDuration(Number(event.target.value))}
              className="practice-slider"
            />
          </div>
        </div>

        <div className="practice-modal-footer">
          <button type="button" className="secondary-link" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="primary-action" onClick={handleBegin} disabled={!moduleId}>
            Start Session →
          </button>
        </div>
      </div>
    </div>
  );
}
