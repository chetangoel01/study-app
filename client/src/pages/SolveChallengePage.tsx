import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import Editor from '@monaco-editor/react';
import { useDailyChallenge } from '../hooks/usePractice.js';

export function SolveChallengePage() {
  const navigate = useNavigate();
  const { data, loading, submitCode } = useDailyChallenge();
  
  const [code, setCode] = useState('');
  const [output, setOutput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (data?.starterCode && !code) {
      setCode(data.starterCode);
    }
  }, [data]);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const result = await submitCode(code);
      setOutput(result.output || 'No output returned');
    } catch (e) {
      setOutput('Execution failed due to network error.');
    }
    setIsSubmitting(false);
  };

  if (loading) return <div className="loading">Loading sandbox...</div>;
  if (!data) return <div className="error">Failed to load challenge.</div>;

  return (
    <div className="solve-page">
      <header className="solve-header">
        <button className="secondary-link" onClick={() => navigate('/practice')}>
          ← Back to Practice
        </button>
        <div className="solve-title">
          <h2>{data.title}</h2>
          <span className={`solve-badge ${data.difficulty?.toLowerCase()}`}>
            {data.difficulty}
          </span>
        </div>
        <button 
          className="primary-action" 
          onClick={handleSubmit} 
          disabled={isSubmitting || data.completed}
        >
          {isSubmitting ? 'Running...' : data.completed ? 'Completed ✓' : 'Submit Code'}
        </button>
      </header>
      
      <div className="solve-workspace">
        <div className="solve-pane solve-problem">
          <div className="markdown-body">
            <ReactMarkdown>{data.descriptionMarkdown}</ReactMarkdown>
          </div>
          
          {output && (
            <div className="solve-console">
              <h3>Console Output</h3>
              <pre className={output.includes('Failed') ? 'error-text' : 'success-text'}>
                {output}
              </pre>
            </div>
          )}
        </div>
        
        <div className="solve-pane solve-editor">
          <Editor
            height="100%"
            defaultLanguage="javascript"
            theme="vs-dark"
            value={code}
            onChange={(val) => setCode(val || '')}
            options={{
              minimap: { enabled: false },
              fontSize: 14,
              padding: { top: 16 },
              lineNumbers: 'on',
              scrollBeyondLastLine: false,
            }}
          />
        </div>
      </div>
    </div>
  );
}
