import { useEffect, useState } from 'react';

interface Props {
  onClose: () => void;
}

type Difficulty = 'Easy' | 'Medium' | 'Hard';

const TOPICS = [
  'Arrays',
  'Linked Lists',
  'Trees',
  'Graphs',
  'Dynamic Programming',
  'System Design',
  'Concurrency',
];

export function PracticeSetupModal({ onClose }: Props) {
  const [topic, setTopic] = useState('Arrays');
  const [difficulty, setDifficulty] = useState<Difficulty>('Medium');
  const [duration, setDuration] = useState(45);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleBegin = () => {
    window.alert(`Starting ${difficulty} session on ${topic} for ${duration} min`);
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
        <h2 id="practice-setup-title" className="modal-title">Configure Mock Interview</h2>
        <p className="modal-body">
          Fine-tune your environment to simulate a real-world technical assessment.
        </p>

        <div className="practice-form">
          <label className="field-label" htmlFor="practice-topic">Topic</label>
          <select
            id="practice-topic"
            className="practice-select"
            value={topic}
            onChange={(event) => setTopic(event.target.value)}
          >
            {TOPICS.map((entry) => <option key={entry} value={entry}>{entry}</option>)}
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
          <button type="button" className="primary-action" onClick={handleBegin}>
            Begin Session →
          </button>
        </div>
      </div>
    </div>
  );
}
