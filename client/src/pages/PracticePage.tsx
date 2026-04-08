import { useState } from 'react';
import { PracticeSetupModal } from '../components/PracticeSetupModal.js';

export function PracticePage() {
  const [showSetup, setShowSetup] = useState(false);

  return (
    <div className="stub-page">
      <h1>Deep Practice</h1>
      <p className="page-muted">
        Quiet the noise. Focus on the logic. Today is about deliberate improvement.
      </p>
      <button
        type="button"
        className="primary-action"
        style={{ marginTop: '1.5rem', display: 'inline-flex' }}
        onClick={() => setShowSetup(true)}
      >
        Configure Session →
      </button>
      {showSetup && <PracticeSetupModal onClose={() => setShowSetup(false)} />}
    </div>
  );
}
