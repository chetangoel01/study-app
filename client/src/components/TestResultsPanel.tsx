import type { ChallengeTestResult } from '../types.js';

interface TestResultsPanelProps {
  results: ChallengeTestResult[];
}

export function TestResultsPanel({ results }: TestResultsPanelProps) {
  if (!results.length) {
    return (
      <div className="test-results-panel">
        <div className="test-results-header">
          <h3>Test Results</h3>
          <span className="test-results-summary empty">Run your code to see per-test feedback.</span>
        </div>
      </div>
    );
  }

  const passedCount = results.filter((result) => result.passed).length;

  return (
    <div className="test-results-panel">
      <div className="test-results-header">
        <h3>Test Results</h3>
        <span className={`test-results-summary ${passedCount === results.length ? 'success' : 'warning'}`}>
          {passedCount}/{results.length} passed
        </span>
      </div>

      <div className="test-results-list">
        {results.map((result, index) => (
          <div key={`${index}-${result.output}`} className={`test-result-row ${result.passed ? 'passed' : 'failed'}`}>
            <div className="test-result-topline">
              <span className="test-result-name">Test {index + 1}</span>
              <span className={`test-result-status ${result.passed ? 'passed' : 'failed'}`}>
                {result.passed ? 'Passed' : 'Failed'}
              </span>
            </div>
            <div className="test-result-body">
              <div>
                <span className="test-result-label">Output</span>
                <pre>{result.output}</pre>
              </div>
              <div>
                <span className="test-result-label">Expected</span>
                <pre>{result.expected}</pre>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
