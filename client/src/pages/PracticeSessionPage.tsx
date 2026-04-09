import { useSearchParams, useNavigate } from 'react-router-dom';

export function PracticeSessionPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  
  const trackId = params.get('trackId');
  const moduleId = params.get('moduleId');
  const difficulty = params.get('difficulty');
  const duration = params.get('duration');

  return (
    <div className="practice-session-page" style={{ padding: '48px', maxWidth: '800px', margin: '0 auto' }}>
      <h1>Focused Practice Session</h1>
      <div className="surface-card">
        <p>You have started a deliberation drill.</p>
        <ul>
          <li><strong>Track:</strong> {trackId}</li>
          <li><strong>Module:</strong> {moduleId}</li>
          <li><strong>Difficulty:</strong> {difficulty}</li>
          <li><strong>Timer:</strong> {duration} Minutes</li>
        </ul>
        <button className="primary-action" style={{ marginTop: '24px' }} onClick={() => navigate('/practice')}>
          End Session
        </button>
      </div>
    </div>
  );
}
