import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useCurriculum, useModuleContent } from '../hooks/useCurriculum.js';
import { useProgress } from '../hooks/useProgress.js';
import { api } from '../api/client.js';
import { MarkdownRenderer } from '../components/MarkdownRenderer.js';
import { ModuleItemList } from '../components/ModuleItemList.js';
import { ReadDoTabs } from '../components/ReadDoTabs.js';

export function ModulePage() {
  const navigate = useNavigate();
  const { trackId, moduleId } = useParams<{ trackId: string; moduleId: string }>();
  const {
    data: curriculum,
    loading: curriculumLoading,
    error: curriculumError,
  } = useCurriculum();
  const {
    data: moduleContent,
    loading: contentLoading,
    error: contentError,
  } = useModuleContent(moduleId ?? '');
  const { toggle, isCompleted } = useProgress();

  const [notes, setNotes] = useState('');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveError, setSaveError] = useState('');
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentNotesRef = useRef('');
  const lastSavedNotesRef = useRef('');
  const saveInFlightRef = useRef(false);
  const saveQueuedRef = useRef(false);
  const notesScopeRef = useRef(0);
  const notesDirtyRef = useRef(false);
  const retryCountRef = useRef(0);

  useEffect(() => {
    if (!moduleId) return;
    let cancelled = false;
    notesScopeRef.current += 1;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    if (retryTimer.current) clearTimeout(retryTimer.current);
    saveInFlightRef.current = false;
    saveQueuedRef.current = false;
    notesDirtyRef.current = false;
    retryCountRef.current = 0;
    setNotes('');
    setSaveStatus('idle');
    setSaveError('');
    api.get<{ content: string }>(`/api/notes/${moduleId}`)
      .then((result) => {
        if (!cancelled && !notesDirtyRef.current) {
          const content = result.content ?? '';
          setNotes(content);
          currentNotesRef.current = content;
          lastSavedNotesRef.current = content;
        }
      })
      .catch(() => {
        if (!cancelled && !notesDirtyRef.current) {
          setNotes('');
          currentNotesRef.current = '';
          lastSavedNotesRef.current = '';
        }
      });

    return () => {
      cancelled = true;
    };
  }, [moduleId]);

  useEffect(() => () => {
    notesScopeRef.current += 1;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    if (retryTimer.current) clearTimeout(retryTimer.current);
  }, []);

  const flushNotesSave = async () => {
    if (!moduleId) return;
    const scope = notesScopeRef.current;
    if (saveInFlightRef.current) {
      saveQueuedRef.current = true;
      return;
    }

    const content = currentNotesRef.current;
    if (content === lastSavedNotesRef.current) {
      setSaveStatus('saved');
      return;
    }

    saveInFlightRef.current = true;
    saveQueuedRef.current = false;
    let saveSucceeded = false;
    let shouldRetry = false;

    try {
      await api.put(`/api/notes/${moduleId}`, { content });
      if (scope !== notesScopeRef.current) return;
      lastSavedNotesRef.current = content;
      retryCountRef.current = 0;
      setSaveError('');
      saveSucceeded = true;
    } catch (error) {
      if (scope !== notesScopeRef.current) return;
      const status = (error as { status?: number }).status;
      shouldRetry = status === undefined || status >= 500;
      setSaveStatus(shouldRetry ? 'saving' : 'error');
      setSaveError(status === 413 ? 'Note too long to save.' : 'Unable to save notes.');
    } finally {
      if (scope !== notesScopeRef.current) return;
      saveInFlightRef.current = false;
      if (saveSucceeded && (saveQueuedRef.current || currentNotesRef.current !== lastSavedNotesRef.current)) {
        void flushNotesSave();
      } else if (saveSucceeded) {
        setSaveStatus('saved');
      } else if (shouldRetry && currentNotesRef.current !== lastSavedNotesRef.current) {
        const retryDelay = Math.min(1000 * (2 ** retryCountRef.current), 5000);
        retryCountRef.current += 1;
        if (retryTimer.current) clearTimeout(retryTimer.current);
        // Retry with backoff so transient failures don't strand edits or spin in a tight loop.
        retryTimer.current = setTimeout(() => {
          retryTimer.current = null;
          void flushNotesSave();
        }, retryDelay);
      }
    }
  };

  const handleNotesChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    if (!moduleId) return;
    const value = event.target.value;
    notesDirtyRef.current = true;
    retryCountRef.current = 0;
    setNotes(value);
    currentNotesRef.current = value;
    setSaveStatus('saving');
    setSaveError('');
    if (saveTimer.current) clearTimeout(saveTimer.current);
    if (retryTimer.current) clearTimeout(retryTimer.current);
    saveTimer.current = setTimeout(() => {
      void flushNotesSave();
    }, 1000);
  };

  if (curriculumLoading) return <div className="loading">Loading...</div>;
  if (curriculumError) return <div className="error">Error: {curriculumError}</div>;
  if (!curriculum || !trackId || !moduleId) return null;

  const track = curriculum.tracks.find((candidate) => candidate.id === trackId);
  const module = curriculum.modules.find(
    (candidate) => candidate.id === moduleId && candidate.track === trackId
  );

  if (!track || !module) {
    return <div className="error">Module not found.</div>;
  }

  const trackModules = curriculum.modules.filter((candidate) => candidate.track === trackId);
  const currentIndex = trackModules.findIndex((candidate) => candidate.id === moduleId);
  const prevModule = currentIndex > 0 ? trackModules[currentIndex - 1] : null;
  const nextModule = currentIndex >= 0 && currentIndex < trackModules.length - 1
    ? trackModules[currentIndex + 1]
    : null;

  const items = moduleContent?.items ?? module.items;
  const topics = moduleContent?.topics ?? [];
  const noGeneratedContent = !contentLoading && !contentError && topics.length === 0;

  const readColumn = (
    <div className="read-column">
      <p className="panel-label">Read</p>
      {contentLoading ? (
        <MarkdownRenderer content="" loading />
      ) : contentError ? (
        <MarkdownRenderer
          content=""
          error="Unable to load module content right now."
        />
      ) : noGeneratedContent ? (
        <MarkdownRenderer content="" />
      ) : (
        topics.map((topic) => (
          <section key={topic.id} className="topic-section">
            <h3>{topic.label}</h3>
            <MarkdownRenderer
              content={topic.study_guide_markdown}
            />
          </section>
        ))
      )}
      <div className="go-deeper">
        <p className="panel-label">Go deeper</p>
        <ModuleItemList
          items={items}
          moduleId={module.id}
          isCompleted={isCompleted}
          onToggle={toggle}
          filter={['read']}
        />
      </div>
    </div>
  );

  const doColumn = (
    <div className="do-column">
      <p className="panel-label">Do</p>
      <ModuleItemList
        items={items}
        moduleId={module.id}
        isCompleted={isCompleted}
        onToggle={toggle}
        filter={['do', 'check']}
      />
    </div>
  );

  return (
    <div className="module-page">
      <div className="module-topbar">
        <Link to={`/track/${track.id}`} className="back-link">← {track.label}</Link>
        <h1 className="module-page-title">{module.title}</h1>
        <div className="module-nav">
          {prevModule ? (
            <button
              type="button"
              onClick={() => navigate(`/track/${track.id}/module/${prevModule.id}`)}
            >
              ← Prev
            </button>
          ) : <span />}
          {nextModule ? (
            <button
              type="button"
              onClick={() => navigate(`/track/${track.id}/module/${nextModule.id}`)}
            >
              Next →
            </button>
          ) : (
            <span className="track-complete">
              Track complete - <Link to="/">switch tracks</Link>
            </span>
          )}
        </div>
      </div>

      <div className="module-columns">
        {readColumn}
        {doColumn}
      </div>

      <div className="mobile-only">
        <ReadDoTabs readContent={readColumn} doContent={doColumn} />
      </div>

      <div className="notes-section">
        <label htmlFor="module-notes">
          Notes
          <span className={`save-status${saveStatus === 'error' ? ' error' : ''}`}>
            {saveStatus === 'saving'
              ? ' · Saving...'
              : saveStatus === 'saved'
                ? ' · Saved'
                : saveStatus === 'error'
                  ? ` · ${saveError}`
                : ''}
          </span>
        </label>
        <textarea
          id="module-notes"
          value={notes}
          onChange={handleNotesChange}
          placeholder="Capture weak spots, patterns, or links..."
          rows={6}
        />
      </div>
    </div>
  );
}
