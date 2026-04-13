import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import Editor from '@monaco-editor/react';
import { TestResultsPanel } from '../components/TestResultsPanel.js';
import { useChallenge } from '../hooks/usePractice.js';
import type { ChallengeTestResult } from '../types.js';

function formatRemainingTime(totalSeconds: number) {
  const safeSeconds = Math.max(0, totalSeconds);
  const mins = Math.floor(safeSeconds / 60);
  const secs = safeSeconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function SolveChallengePage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { data, loading, runCode, submitCode } = useChallenge(id);

  const [code, setCode] = useState('');
  const [results, setResults] = useState<ChallengeTestResult[]>([]);
  const [statusMessage, setStatusMessage] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(0);

  useEffect(() => {
    if (!data) return;
    setCode(data.starterCode || '');
    setResults([]);
    setStatusMessage('');
    setRemainingSeconds((data.durationMins || 30) * 60);
  }, [data?.id, data?.starterCode, data?.durationMins]);

  useEffect(() => {
    if (!data || data.completed) return;

    const timerId = window.setInterval(() => {
      setRemainingSeconds((current) => {
        if (current <= 1) {
          window.clearInterval(timerId);
          return 0;
        }
        return current - 1;
      });
    }, 1000);

    return () => window.clearInterval(timerId);
  }, [data?.id, data?.completed]);

  const passCount = useMemo(
    () => results.filter((result) => result.passed).length,
    [results],
  );

  const handleRun = async (submit = false) => {
    setIsRunning(true);
    setStatusMessage('');

    try {
      const result = submit ? await submitCode(code) : await runCode(code);
      setResults(result.results);

      if (submit) {
        setStatusMessage(
          result.allPassed
            ? 'All tests passed. Challenge marked complete.'
            : 'Submission ran, but not all tests passed yet.',
        );
      } else {
        setStatusMessage(
          result.allPassed
            ? 'All visible tests passed.'
            : 'Run complete. Review the failing cases below.',
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Execution failed due to network error.';
      setResults([{ passed: false, output: message, expected: '' }]);
      setStatusMessage(message);
    } finally {
      setIsRunning(false);
    }
  };

  if (loading) return <div className="loading">Loading challenge...</div>;
  if (!data) return <div className="error">Challenge not found.</div>;

  return (
    <div className="solve-page">
      <header className="solve-header">
        <button className="secondary-link" onClick={() => navigate('/practice')}>
          ← Back to Practice
        </button>

        <div className="solve-title-block">
          <div className="solve-title-row">
            <h1>{data.title}</h1>
            <span className={`solve-badge ${data.difficulty?.toLowerCase()}`}>{data.difficulty || 'Medium'}</span>
          </div>
          <div className="solve-meta-row">
            <span>{data.functionName}()</span>
            <span>•</span>
            <span>{data.tags?.join(', ') || 'coding challenge'}</span>
            <span>•</span>
            <span>{data.testCases?.length ?? 0} tests</span>
          </div>
        </div>

        <div className="solve-header-actions">
          <div className={`solve-timer ${remainingSeconds === 0 ? 'expired' : ''}`}>
            {data.completed ? 'Completed' : formatRemainingTime(remainingSeconds)}
          </div>
          <button
            className="secondary-link solve-run-btn"
            onClick={() => void handleRun(false)}
            disabled={isRunning}
          >
            {isRunning ? 'Running...' : 'Run Code'}
          </button>
          <button
            className="primary-action"
            onClick={() => void handleRun(true)}
            disabled={isRunning || data.completed}
          >
            {data.completed ? 'Completed ✓' : isRunning ? 'Submitting...' : 'Submit'}
          </button>
        </div>
      </header>

      <div className="solve-layout">
        <section className="solve-card solve-problem-card">
          <div className="solve-problem-top">
            <div>
              <p className="solve-label">Prompt</p>
              <div className="markdown-body solve-markdown">
                <ReactMarkdown>{data.descriptionMarkdown}</ReactMarkdown>
              </div>
            </div>

            <div className="solve-problem-aside">
              <div className="solve-chip-row">
                {(data.tags ?? []).map((tag) => (
                  <span key={tag} className="solve-chip">{tag}</span>
                ))}
              </div>
              {data.leetcodeUrl && (
                <a className="solve-link" href={data.leetcodeUrl} target="_blank" rel="noreferrer">
                  View original prompt
                </a>
              )}
            </div>
          </div>

          <div className="solve-status-row">
            <span className={`solve-status-pill ${passCount === results.length && results.length > 0 ? 'success' : 'neutral'}`}>
              {results.length ? `${passCount}/${results.length} tests passing` : 'No runs yet'}
            </span>
            {statusMessage ? <span className="solve-status-text">{statusMessage}</span> : null}
          </div>

          <TestResultsPanel results={results} />
        </section>

        <section className="solve-card solve-editor-card">
          <div className="solve-editor-header">
            <div>
              <p className="solve-label">Python Editor</p>
              <p className="solve-editor-hint">Implement `{data.functionName}` exactly as named.</p>
            </div>
          </div>

          <div className="solve-editor-shell">
            <Editor
              height="100%"
              defaultLanguage="python"
              language="python"
              theme="vs-dark"
              value={code}
              onChange={(value) => setCode(value || '')}
              options={{
                minimap: { enabled: false },
                fontSize: 14,
                padding: { top: 16 },
                lineNumbers: 'on',
                scrollBeyondLastLine: false,
                wordWrap: 'on',
              }}
            />
          </div>
        </section>
      </div>
    </div>
  );
}
