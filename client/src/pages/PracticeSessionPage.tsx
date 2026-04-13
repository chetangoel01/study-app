import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';

type PracticeMode = 'dsa' | 'system-design-mcq' | 'concurrency-open';
type SessionDifficulty = 'Easy' | 'Medium' | 'Hard';
type SubmitReason = 'manual' | 'timeout';

interface PracticePromptModeContent {
  label: string;
  description: string;
  prompts: string[];
}

interface SystemDesignQuestion {
  id: string;
  difficulty: SessionDifficulty;
  prompt: string;
  options: string[];
  answerIndex: number;
  explanation: string;
}

interface PracticeQuizSpecResponse {
  spec: {
    id: number;
    slug: string;
    mode: string;
    trackId: string;
    moduleId: string;
    title: string;
    descriptionMarkdown: string;
    defaultDurationMins: number;
  };
  questions: Array<{
    id: number;
    difficulty: string;
    prompt: string;
    options: string[];
    answerIndex: number;
    explanation: string;
  }>;
}

const sessionModeContent: Record<
  PracticeMode,
  PracticePromptModeContent
> = {
  dsa: {
    label: 'DSA Drill',
    description: 'Implement a clean, correct solution and optimize after passing baseline tests.',
    prompts: [
      'Start with a brute-force approach, then reduce time complexity step by step.',
      'Name your invariants before writing loops.',
      'Add one adversarial test case before finalizing your solution.',
    ],
  },
  'system-design-mcq': {
    label: 'System Design MCQ Set',
    description: 'Pick the strongest architecture tradeoff for each short prompt.',
    prompts: [],
  },
  'concurrency-open': {
    label: 'Concurrency Open Response',
    description: 'Explain how you would reason about correctness under parallel execution.',
    prompts: [
      'Describe a race condition you have seen and how you proved the fix.',
      'When would you choose message passing over shared memory and locks?',
      'How do you keep throughput high while avoiding deadlocks in worker pools?',
    ],
  },
};

const SYSTEM_DESIGN_QUESTION_BANK: SystemDesignQuestion[] = [
  {
    id: 'read-heavy-cache',
    difficulty: 'Easy',
    prompt: 'Your product catalog gets 20x more reads than writes. What is the safest first optimization?',
    options: [
      'Introduce a read-through cache in front of the database',
      'Shard the database immediately by product id',
      'Use two-phase commit across all services',
      'Move all reads to a graph database',
    ],
    answerIndex: 0,
    explanation: 'Read-through caching reduces repeated DB reads with minimal architectural risk for read-heavy traffic.',
  },
  {
    id: 'session-state-choice',
    difficulty: 'Easy',
    prompt: 'You run many stateless app instances behind a load balancer. Where should session state live?',
    options: [
      'In process memory on each app instance',
      'In a shared store like Redis',
      'In local browser storage only',
      'Inside DNS records',
    ],
    answerIndex: 1,
    explanation: 'A shared session store preserves continuity when requests land on different app instances.',
  },
  {
    id: 'metrics-first',
    difficulty: 'Easy',
    prompt: 'A latency-sensitive endpoint slows down. Which metric should you inspect first?',
    options: [
      'P95/P99 response latency',
      'Total number of repositories in the org',
      'Team vacation calendar coverage',
      'CSS bundle size for the login page',
    ],
    answerIndex: 0,
    explanation: 'Tail latency is the fastest signal for user-facing degradation on latency-sensitive paths.',
  },
  {
    id: 'queue-decoupling',
    difficulty: 'Easy',
    prompt: 'Order checkout should stay responsive even when sending emails is slow. What is the best design?',
    options: [
      'Send emails synchronously in checkout request',
      'Drop email notifications during spikes',
      'Publish events to a queue and process asynchronously',
      'Block checkout until email provider confirms',
    ],
    answerIndex: 2,
    explanation: 'Queues decouple critical user paths from slow non-critical downstream work.',
  },
  {
    id: 'idempotency-keys',
    difficulty: 'Medium',
    prompt: 'Payment clients may retry on network timeout. Where should idempotency be enforced?',
    options: [
      'In the mobile app only',
      'At the payment write boundary on the server',
      'Inside the CDN edge cache',
      'In the frontend route definitions',
    ],
    answerIndex: 1,
    explanation: 'Server-side idempotency at the write boundary prevents duplicate charges from client retries.',
  },
  {
    id: 'hot-key-sharding',
    difficulty: 'Medium',
    prompt: 'One tenant becomes a hot key and overloads a single partition. What is the best mitigation?',
    options: [
      'Increase request timeout to 60 seconds',
      'Randomly sample 1% of writes',
      'Introduce key bucketing or tenant-level sub-sharding',
      'Switch from HTTP to FTP',
    ],
    answerIndex: 2,
    explanation: 'Sub-sharding hot tenants spreads load and removes single-partition hotspots.',
  },
  {
    id: 'eventual-consistency-ui',
    difficulty: 'Medium',
    prompt: 'A profile update is eventually consistent across regions. What UX approach is most practical?',
    options: [
      'Show stale data forever to avoid surprises',
      'Display optimistic update with pending/sync status',
      'Disable profile editing globally',
      'Force users to refresh five times',
    ],
    answerIndex: 1,
    explanation: 'Optimistic UI with sync indicators balances responsiveness and correctness in eventually consistent systems.',
  },
  {
    id: 'rate-limiting-boundary',
    difficulty: 'Medium',
    prompt: 'Where should rate limiting usually be applied for public APIs?',
    options: [
      'Only inside each microservice method',
      'At a consistent ingress boundary (gateway/load balancer)',
      'Inside the database trigger layer only',
      'In CI/CD pipeline steps',
    ],
    answerIndex: 1,
    explanation: 'Ingress rate limiting provides centralized protection and predictable enforcement.',
  },
  {
    id: 'replica-lag-read',
    difficulty: 'Medium',
    prompt: 'Users complain they cannot see their just-created comment. Reads come from replicas. Most likely cause?',
    options: [
      'Replica lag causing read-after-write inconsistency',
      'The load balancer switched AZs',
      'Index pages are too long',
      'Unit tests are flaky',
    ],
    answerIndex: 0,
    explanation: 'Replica lag is a common source of read-after-write anomalies when writes go to primary only.',
  },
  {
    id: 'slo-alerting',
    difficulty: 'Medium',
    prompt: 'What alerting strategy best aligns with user impact?',
    options: [
      'Alert on every single error log line',
      'Alert on SLO burn rate and sustained error budget consumption',
      'Alert only when CPU reaches 100%',
      'Disable alerts during business hours',
    ],
    answerIndex: 1,
    explanation: 'Burn-rate alerts tie operations directly to reliability targets and user impact.',
  },
  {
    id: 'backpressure-choice',
    difficulty: 'Medium',
    prompt: 'A downstream dependency is saturated. What is the most robust immediate strategy?',
    options: [
      'Retry aggressively with zero delay',
      'Introduce backpressure with bounded queues and circuit breaking',
      'Ignore failures and continue writing',
      'Increase all request payload sizes',
    ],
    answerIndex: 1,
    explanation: 'Backpressure and circuit breakers prevent cascading failures under downstream saturation.',
  },
  {
    id: 'cdn-cache-invalidation',
    difficulty: 'Medium',
    prompt: 'Static assets are cached globally via CDN. A critical JS bug is fixed. Best rollout step?',
    options: [
      'Keep same filename and wait for TTL expiry',
      'Use content-hashed asset names and deploy new references',
      'Ask users to clear browser cache manually',
      'Disable CDN permanently',
    ],
    answerIndex: 1,
    explanation: 'Content hashing gives deterministic cache busting and avoids stale critical assets.',
  },
  {
    id: 'multi-region-writes',
    difficulty: 'Hard',
    prompt: 'You need active-active multi-region writes with conflict handling. Which pattern is most suitable?',
    options: [
      'Single leader only with no replication',
      'CRDTs or versioned conflict-resolution strategy',
      'Turn off clocks on all nodes',
      'Use local files per region',
    ],
    answerIndex: 1,
    explanation: 'Active-active writes need deterministic conflict resolution, often via CRDTs or version semantics.',
  },
  {
    id: 'exactly-once-messaging',
    difficulty: 'Hard',
    prompt: 'In distributed queues, what is generally the safest practical model?',
    options: [
      'Exactly-once delivery by default with no caveats',
      'At-most-once delivery with no retries',
      'At-least-once delivery plus idempotent consumers',
      'Broadcast every message to every consumer',
    ],
    answerIndex: 2,
    explanation: 'At-least-once with idempotent handlers is usually the practical reliability tradeoff.',
  },
  {
    id: 'global-ordering',
    difficulty: 'Hard',
    prompt: 'A globally ordered event stream across all partitions is required. What tradeoff is unavoidable?',
    options: [
      'Higher coordination cost and reduced horizontal throughput',
      'Zero latency across all regions',
      'No need for clocks or consensus',
      'Guaranteed offline writes without merge logic',
    ],
    answerIndex: 0,
    explanation: 'Global ordering requires stronger coordination, which limits throughput and adds latency.',
  },
  {
    id: 'distributed-locking-risk',
    difficulty: 'Hard',
    prompt: 'You add distributed locking for critical tasks. What extra safeguard is most important?',
    options: [
      'Rely on lock acquisition only and skip task idempotency',
      'Pair locks with fencing tokens or task version checks',
      'Run all workers on one machine',
      'Disable lock expiry to avoid renewals',
    ],
    answerIndex: 1,
    explanation: 'Fencing tokens/version checks protect against stale lock holders and split-brain scenarios.',
  },
  {
    id: 'schema-evolution',
    difficulty: 'Hard',
    prompt: 'Multiple services consume async events. How should schema changes be introduced safely?',
    options: [
      'Breaking field renames in place overnight',
      'Versioned, backward-compatible evolution with deprecation windows',
      'Send raw SQL dumps in events',
      'Remove old fields immediately after deploy',
    ],
    answerIndex: 1,
    explanation: 'Versioned backward-compatible changes avoid consumer breakage in distributed event ecosystems.',
  },
];

function normalizeDifficulty(value: string | null): SessionDifficulty {
  const normalized = value?.trim().toLowerCase();
  if (normalized === 'easy') return 'Easy';
  if (normalized === 'hard') return 'Hard';
  return 'Medium';
}

function parseDuration(value: string | null): number {
  const parsed = Number(value ?? 30);
  if (!Number.isFinite(parsed)) return 30;
  return Math.min(90, Math.max(10, Math.round(parsed)));
}

function getQuestionTarget(durationMinutes: number): number {
  const roughTarget = Math.round(durationMinutes / 3);
  return Math.max(5, Math.min(15, roughTarget));
}

function buildSystemDesignQuiz(difficulty: SessionDifficulty, durationMinutes: number): SystemDesignQuestion[] {
  const target = getQuestionTarget(durationMinutes);
  const primaryPool = SYSTEM_DESIGN_QUESTION_BANK.filter((question) => question.difficulty === difficulty);
  const fallbackPool = SYSTEM_DESIGN_QUESTION_BANK.filter((question) => question.difficulty !== difficulty);
  return [...primaryPool, ...fallbackPool].slice(0, Math.min(target, SYSTEM_DESIGN_QUESTION_BANK.length));
}

function formatTimer(remainingSeconds: number): string {
  const mins = Math.floor(remainingSeconds / 60);
  const secs = remainingSeconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function optionLabel(index: number): string {
  return String.fromCharCode(65 + index);
}

export function PracticeSessionPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const hasRecordedSession = useRef(false);

  const trackId = params.get('trackId') ?? 'system-design';
  const moduleId = params.get('moduleId') ?? 'system-design-mcq';
  const modeParam = params.get('mode') as PracticeMode | null;
  const mode = modeParam && modeParam in sessionModeContent ? modeParam : null;
  const modeContent = mode ? sessionModeContent[mode] : null;
  const difficulty = normalizeDifficulty(params.get('difficulty'));
  const durationMinutes = parseDuration(params.get('duration'));
  const isSystemDesignMcq = mode === 'system-design-mcq';

  const fallbackQuestions = useMemo(
    () => (isSystemDesignMcq ? buildSystemDesignQuiz(difficulty, durationMinutes) : []),
    [isSystemDesignMcq, difficulty, durationMinutes],
  );
  const [remoteQuiz, setRemoteQuiz] = useState<{
    title: string;
    description: string;
    questions: SystemDesignQuestion[];
  } | null>(null);
  const [quizLoadState, setQuizLoadState] = useState<'idle' | 'loading' | 'ready' | 'fallback'>('idle');

  useEffect(() => {
    if (!isSystemDesignMcq) {
      setRemoteQuiz(null);
      setQuizLoadState('idle');
      return;
    }

    let cancelled = false;
    setQuizLoadState('loading');
    const query = new URLSearchParams({
      mode: mode ?? 'system-design-mcq',
      trackId,
      moduleId,
      difficulty,
      duration: String(durationMinutes),
    });

    api.get<PracticeQuizSpecResponse>(`/api/practice/quiz-spec?${query.toString()}`)
      .then((payload) => {
        if (cancelled) return;
        const mappedQuestions = payload.questions
          .map<SystemDesignQuestion | null>((question) => {
            const options = Array.isArray(question.options)
              ? question.options.filter((option) => typeof option === 'string' && option.trim().length > 0)
              : [];
            if (options.length < 2) return null;
            if (!Number.isInteger(question.answerIndex) || question.answerIndex < 0 || question.answerIndex >= options.length) {
              return null;
            }
            return {
              id: String(question.id),
              difficulty: normalizeDifficulty(question.difficulty ?? null),
              prompt: String(question.prompt ?? '').trim(),
              options,
              answerIndex: question.answerIndex,
              explanation: String(question.explanation ?? '').trim(),
            };
          })
          .filter((question): question is SystemDesignQuestion => Boolean(question?.prompt));

        if (mappedQuestions.length === 0) {
          setRemoteQuiz(null);
          setQuizLoadState('fallback');
          return;
        }

        setRemoteQuiz({
          title: payload.spec.title || 'System Design MCQ Set',
          description: payload.spec.descriptionMarkdown || '',
          questions: mappedQuestions,
        });
        setQuizLoadState('ready');
      })
      .catch(() => {
        if (cancelled) return;
        setRemoteQuiz(null);
        setQuizLoadState('fallback');
      });

    return () => {
      cancelled = true;
    };
  }, [isSystemDesignMcq, mode, trackId, moduleId, difficulty, durationMinutes]);

  const questions = useMemo(() => {
    if (remoteQuiz?.questions.length) return remoteQuiz.questions;
    if (quizLoadState === 'loading') return [];
    return fallbackQuestions;
  }, [remoteQuiz, fallbackQuestions, quizLoadState]);
  const quizTitle = remoteQuiz?.title || 'System Design MCQ Set';
  const quizDescription = remoteQuiz?.description || modeContent?.description || '';
  const usingFallbackQuiz = isSystemDesignMcq && quizLoadState === 'fallback';
  const loadingQuiz = isSystemDesignMcq && quizLoadState === 'loading';

  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, number>>({});
  const [submitted, setSubmitted] = useState(false);
  const [submitReason, setSubmitReason] = useState<SubmitReason | null>(null);
  const [finalCorrectCount, setFinalCorrectCount] = useState(0);
  const [finalScore, setFinalScore] = useState(0);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [remainingSeconds, setRemainingSeconds] = useState(durationMinutes * 60);

  useEffect(() => {
    setCurrentQuestionIndex(0);
    setSelectedAnswers({});
    setSubmitted(false);
    setSubmitReason(null);
    setFinalCorrectCount(0);
    setFinalScore(0);
    setSaveState('idle');
    setRemainingSeconds(durationMinutes * 60);
    hasRecordedSession.current = false;
  }, [difficulty, durationMinutes, mode, moduleId, trackId]);

  const answeredCount = useMemo(
    () => questions.reduce((count, question) => count + (typeof selectedAnswers[question.id] === 'number' ? 1 : 0), 0),
    [questions, selectedAnswers],
  );

  const currentQuestion = questions[currentQuestionIndex] ?? null;
  const currentSelectedIndex = currentQuestion ? selectedAnswers[currentQuestion.id] : undefined;

  const recordSession = (score: number, reason: SubmitReason) => {
    if (hasRecordedSession.current) return;
    hasRecordedSession.current = true;
    setSaveState('saving');
    const elapsedSeconds = Math.max(0, durationMinutes * 60 - remainingSeconds);
    const sessionDurationSeconds = reason === 'timeout'
      ? durationMinutes * 60
      : Math.max(60, elapsedSeconds);

    void api.post('/api/practice/sessions', {
      type: 'system_design_mcq',
      title: quizTitle,
      durationSeconds: sessionDurationSeconds,
      score,
    })
      .then(() => setSaveState('saved'))
      .catch(() => setSaveState('error'));
  };

  const finalizeQuiz = (reason: SubmitReason) => {
    if (!isSystemDesignMcq || submitted || questions.length === 0) return;
    const correctCount = questions.reduce(
      (count, question) => count + (selectedAnswers[question.id] === question.answerIndex ? 1 : 0),
      0,
    );
    const score = Math.round((correctCount / questions.length) * 100);
    setFinalCorrectCount(correctCount);
    setFinalScore(score);
    setSubmitted(true);
    setSubmitReason(reason);
    recordSession(score, reason);
  };

  useEffect(() => {
    if (!isSystemDesignMcq || submitted) return;
    const timer = window.setInterval(() => {
      setRemainingSeconds((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [isSystemDesignMcq, submitted]);

  useEffect(() => {
    if (!isSystemDesignMcq || submitted || remainingSeconds > 0) return;
    finalizeQuiz('timeout');
  }, [finalizeQuiz, isSystemDesignMcq, remainingSeconds, submitted]);

  const restartQuiz = () => {
    setCurrentQuestionIndex(0);
    setSelectedAnswers({});
    setSubmitted(false);
    setSubmitReason(null);
    setFinalCorrectCount(0);
    setFinalScore(0);
    setSaveState('idle');
    setRemainingSeconds(durationMinutes * 60);
    hasRecordedSession.current = false;
  };

  if (!modeContent) {
    return (
      <div className="practice-session-shell">
        <div className="practice-session-fallback">
          <h1>Focused Practice Session</h1>
          <p>Session configuration was invalid. Please restart from practice setup.</p>
          <button className="primary-action" onClick={() => navigate('/practice')}>
            Back to Practice
          </button>
        </div>
      </div>
    );
  }

  if (!isSystemDesignMcq) {
    return (
      <div className="practice-session-shell">
        <div className="practice-session-fallback">
          <h1>{modeContent.label}</h1>
          <p>{modeContent.description}</p>
          <ul className="practice-session-details">
            <li><strong>Track:</strong> {trackId}</li>
            <li><strong>Module:</strong> {moduleId}</li>
            <li><strong>Difficulty:</strong> {difficulty}</li>
            <li><strong>Duration:</strong> {durationMinutes} minutes</li>
          </ul>
          <h3>Starter Prompts</h3>
          <ol className="practice-session-prompts">
            {modeContent.prompts.map((prompt) => (
              <li key={prompt}>{prompt}</li>
            ))}
          </ol>
          <button className="primary-action" onClick={() => navigate('/practice')}>
            End Session
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="practice-session-shell">
      <section className="practice-session-card">
        <header className="practice-session-topbar">
          <div>
            <p className="practice-session-label">Live Quiz</p>
            <h1>{quizTitle}</h1>
            {quizDescription ? (
              <p className="practice-session-description">{quizDescription}</p>
            ) : null}
          </div>
          <div className={`practice-session-timer${remainingSeconds <= 120 ? ' danger' : ''}`}>
            {formatTimer(remainingSeconds)}
          </div>
        </header>

        <div className="practice-session-meta">
          <span className="practice-session-chip">Difficulty: {difficulty}</span>
          <span className="practice-session-chip">Target: {durationMinutes} min</span>
          <span className="practice-session-chip">Answered: {answeredCount}/{questions.length}</span>
          {usingFallbackQuiz ? (
            <span className="practice-session-chip">Using Built-In Fallback Quiz</span>
          ) : null}
        </div>

        <div className="practice-session-progress-track" aria-hidden="true">
          <div
            className="practice-session-progress-fill"
            style={{ width: `${Math.round(((currentQuestionIndex + 1) / Math.max(1, questions.length)) * 100)}%` }}
          />
        </div>

        {loadingQuiz && (
          <div className="loading" style={{ marginTop: '1rem' }}>
            Loading quiz spec...
          </div>
        )}

        {!submitted && currentQuestion && (
          <article className="quiz-question-card">
            <p className="quiz-question-eyebrow">
              Question {currentQuestionIndex + 1} of {questions.length}
            </p>
            <h2 className="quiz-question-prompt">{currentQuestion.prompt}</h2>

            <div className="quiz-option-list">
              {currentQuestion.options.map((option, optionIndex) => {
                const selected = currentSelectedIndex === optionIndex;
                return (
                  <button
                    key={option}
                    type="button"
                    className={`quiz-option${selected ? ' selected' : ''}`}
                    onClick={() =>
                      setSelectedAnswers((prev) => ({
                        ...prev,
                        [currentQuestion.id]: optionIndex,
                      }))
                    }
                  >
                    <span className="quiz-option-label">{optionLabel(optionIndex)}</span>
                    <span>{option}</span>
                  </button>
                );
              })}
            </div>

            <footer className="quiz-nav">
              <button
                type="button"
                className="secondary-link"
                disabled={currentQuestionIndex === 0}
                onClick={() => setCurrentQuestionIndex((prev) => Math.max(0, prev - 1))}
              >
                Previous
              </button>

              {currentQuestionIndex < questions.length - 1 ? (
                <button
                  type="button"
                  className="primary-action"
                  onClick={() => setCurrentQuestionIndex((prev) => Math.min(questions.length - 1, prev + 1))}
                >
                  Next Question
                </button>
              ) : (
                <button
                  type="button"
                  className="primary-action"
                  onClick={() => finalizeQuiz('manual')}
                >
                  Finish Quiz
                </button>
              )}
            </footer>
          </article>
        )}

        {!loadingQuiz && !submitted && !currentQuestion && (
          <div className="practice-session-empty">
            No quiz questions are configured yet for this mode. Add them via admin quiz endpoints.
          </div>
        )}

        {submitted && (
          <section className="quiz-results">
            <p className="quiz-status-note">
              {submitReason === 'timeout'
                ? 'Time is up. Your results were auto-submitted.'
                : 'Quiz complete. Nice work pushing through this set.'}
            </p>
            <h2 className="quiz-score">
              Score: {finalScore}% ({finalCorrectCount}/{questions.length})
            </h2>
            <p className="quiz-save-state">
              {saveState === 'saving' && 'Saving this session to your practice history...'}
              {saveState === 'saved' && 'Saved to practice history.'}
              {saveState === 'error' && 'Could not save this session, but your score is still shown here.'}
            </p>

            <ol className="quiz-review-list">
              {questions.map((question, index) => {
                const selectedIndex = selectedAnswers[question.id];
                const correct = selectedIndex === question.answerIndex;
                return (
                  <li key={question.id} className="quiz-review-item">
                    <p className="quiz-review-title">{index + 1}. {question.prompt}</p>
                    <p className={`quiz-review-answer ${correct ? 'correct' : 'incorrect'}`}>
                      Your answer:{' '}
                      {typeof selectedIndex === 'number'
                        ? `${optionLabel(selectedIndex)}. ${question.options[selectedIndex]}`
                        : 'Not answered'}
                    </p>
                    {!correct && (
                      <p className="quiz-review-answer correct">
                        Correct answer: {optionLabel(question.answerIndex)}. {question.options[question.answerIndex]}
                      </p>
                    )}
                    <p className="quiz-review-explanation">{question.explanation}</p>
                  </li>
                );
              })}
            </ol>

            <div className="quiz-results-actions">
              <button className="secondary-link" onClick={() => navigate('/practice')}>
                Back to Practice
              </button>
              <button className="primary-action" onClick={restartQuiz}>
                Retake Session
              </button>
            </div>
          </section>
        )}
      </section>
    </div>
  );
}
