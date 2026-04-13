import { useEffect, useId, useRef, useState, useCallback } from 'react';
import type { ChangeEvent, RefObject } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useCurriculum, useModuleContent } from '../hooks/useCurriculum.js';
import { useProgress } from '../hooks/useProgress.js';
import { api } from '../api/client.js';
import { MarkdownRenderer } from '../components/MarkdownRenderer.js';
import { ModuleCompletionModal } from '../components/ModuleCompletionModal.js';
import { ExternalLinkModal } from '../components/ExternalLinkModal.js';

const RESOURCE_ICON_MAP: Record<string, string> = {
  read: 'menu_book',
  do: 'code',
  check: 'task_alt',
};

function extractDomain(url: string | null): string {
  if (!url) return 'Checklist item';
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return 'External resource';
  }
}

/* ── Toolbar helpers ───────────────────────────────────────── */

function wrapSelection(
  textareaRef: RefObject<HTMLTextAreaElement | null>,
  before: string,
  after: string,
  setNotes: (v: string) => void,
  onDirty: () => void,
) {
  const el = textareaRef.current;
  if (!el) return;
  const { selectionStart: s, selectionEnd: e, value } = el;
  const selected = value.slice(s, e);
  const replacement = `${before}${selected || 'text'}${after}`;
  const next = value.slice(0, s) + replacement + value.slice(e);
  setNotes(next);
  onDirty();
  // Re-focus and position cursor after react re-render
  requestAnimationFrame(() => {
    el.focus();
    const cursorPos = selected
      ? s + replacement.length
      : s + before.length;
    const cursorEnd = selected
      ? s + replacement.length
      : s + before.length + 'text'.length;
    el.setSelectionRange(cursorPos, selected ? cursorPos : cursorEnd);
  });
}

function insertBullet(
  textareaRef: RefObject<HTMLTextAreaElement | null>,
  setNotes: (v: string) => void,
  onDirty: () => void,
) {
  const el = textareaRef.current;
  if (!el) return;
  const { selectionStart: s, value } = el;
  // Find start of current line
  const lineStart = value.lastIndexOf('\n', s - 1) + 1;
  const currentLine = value.slice(lineStart, s);
  let next: string;
  let cursorPos: number;
  if (/^\s*- /.test(currentLine)) {
    // Already a bullet line — just add a new bullet below
    next = value.slice(0, s) + '\n- ' + value.slice(s);
    cursorPos = s + 3;
  } else {
    // Prepend bullet to current line
    next = value.slice(0, lineStart) + '- ' + value.slice(lineStart);
    cursorPos = s + 2;
  }
  setNotes(next);
  onDirty();
  requestAnimationFrame(() => {
    el.focus();
    el.setSelectionRange(cursorPos, cursorPos);
  });
}

export function ModulePage() {
  const { trackId, moduleId } = useParams<{ trackId: string; moduleId: string }>();
  const {
    data: curriculum,
    loading: curriculumLoading,
    error: curriculumError,
    refetch: refetchCurriculum,
  } = useCurriculum();
  const {
    data: moduleContent,
    loading: contentLoading,
    error: contentError,
  } = useModuleContent(moduleId ?? '');
  const {
    toggle,
    isCompleted,
    isPending,
    error: progressError,
    statusMessage: progressStatusMessage,
    clearError: clearProgressError,
  } = useProgress();
  const notesDescriptionId = useId();
  const notesFieldHintId = useId();
  const notesStatusId = useId();
  const notesHeadingId = useId();
  const [currentTopicIndex, setCurrentTopicIndex] = useState(0);
  const [showCompletion, setShowCompletion] = useState(false);
  const [pendingUrl, setPendingUrl] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const guideTopRef = useRef<HTMLElement | null>(null);

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
  const prevCompletionPctRef = useRef<number | null>(null);
  const completionTriggeredByUserRef = useRef(false);

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

  const triggerSave = useCallback(() => {
    setSaveStatus('saving');
    setSaveError('');
    if (saveTimer.current) clearTimeout(saveTimer.current);
    if (retryTimer.current) clearTimeout(retryTimer.current);
    saveTimer.current = setTimeout(() => {
      void flushNotesSave();
    }, 1000);
  }, [moduleId]);

  const handleNotesChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    if (!moduleId) return;
    const value = event.target.value;
    notesDirtyRef.current = true;
    retryCountRef.current = 0;
    setNotes(value);
    currentNotesRef.current = value;
    triggerSave();
  };

  // For toolbar: programmatic updates that also trigger save
  const setNotesAndSave = useCallback((value: string) => {
    if (!moduleId) return;
    notesDirtyRef.current = true;
    retryCountRef.current = 0;
    setNotes(value);
    currentNotesRef.current = value;
    triggerSave();
  }, [moduleId, triggerSave]);

  const topics = moduleContent?.topics ?? [];
  const track = curriculum?.tracks.find((candidate) => candidate.id === trackId) ?? null;
  const module = curriculum?.modules.find(
    (candidate) => candidate.id === moduleId && candidate.track === trackId
  ) ?? null;
  const trackModules = trackId && curriculum
    ? curriculum.modules.filter((candidate) => candidate.track === trackId)
    : [];
  const currentIndex = moduleId ? trackModules.findIndex((candidate) => candidate.id === moduleId) : -1;
  const nextModule = currentIndex >= 0 && currentIndex < trackModules.length - 1
    ? trackModules[currentIndex + 1]
    : null;
  const items = module ? (moduleContent?.items ?? module.items) : [];
  const readItems = items.filter((item) => item.type === 'read');
  const actionItems = items.filter((item) => item.type !== 'read');
  const completedCount = module ? items.filter((item) => isCompleted(module.id, item.id)).length : 0;
  const completionPct = items.length > 0 ? Math.round((completedCount / items.length) * 100) : 0;
  const actionCompletedCount = module ? actionItems.filter((item) => isCompleted(module.id, item.id)).length : 0;

  // Restore topic index to last visited step when module changes
  useEffect(() => {
    setCurrentTopicIndex(module?.maxGuideStep ?? 0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moduleId]);

  useEffect(() => {
    const topicCount = moduleContent?.topics?.length ?? 0;
    if (!moduleId || topicCount === 0) return;
    if (currentTopicIndex < 0 || currentTopicIndex > topicCount) return;
    const timer = setTimeout(() => {
      void api
        .put(`/api/progress/${moduleId}/guide-step`, { step: currentTopicIndex })
        .then(() => {
          void refetchCurriculum();
        })
        .catch(() => {});
    }, 400);
    return () => clearTimeout(timer);
  }, [moduleId, moduleContent?.topics, currentTopicIndex, refetchCurriculum]);

  useEffect(() => {
    if (!module) {
      prevCompletionPctRef.current = null;
      completionTriggeredByUserRef.current = false;
      return;
    }

    if (
      completionTriggeredByUserRef.current &&
      prevCompletionPctRef.current !== null &&
      prevCompletionPctRef.current < 100 &&
      completionPct === 100
    ) {
      setShowCompletion(true);
      completionTriggeredByUserRef.current = false;
    }

    prevCompletionPctRef.current = completionPct;
  }, [completionPct, module?.id]);

  if (curriculumLoading) return <div className="loading" role="status" aria-live="polite">Loading...</div>;
  if (curriculumError) return <div className="error" role="alert">Error: {curriculumError}</div>;
  if (!curriculum || !trackId || !moduleId) return null;

  if (!track || !module) {
    return <div className="error" role="alert">Module not found.</div>;
  }

  const saveStatusAnnouncement = saveStatus === 'saving'
    ? 'Saving notes.'
    : saveStatus === 'saved'
      ? 'Notes saved.'
      : saveStatus === 'error'
        ? saveError
        : '';

  const handleToggle = async (
    targetModuleId: string,
    itemId: string,
    itemType: 'read' | 'do' | 'check',
    label: string
  ) => {
    completionTriggeredByUserRef.current = true;
    await toggle(targetModuleId, itemId, itemType, label);
  };

  const currentTopic = topics.length > 0 ? topics[currentTopicIndex] ?? null : null;
  const totalSteps = topics.length + 1; // topics + practice
  const isPracticeStep = currentTopicIndex >= topics.length;
  const isFirstStep = currentTopicIndex === 0;
  const goToStep = (index: number) => {
    setCurrentTopicIndex(index);
    guideTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const renderTopicForwardAction = () => (
    <button
      type="button"
      className="mp-reader-btn mp-reader-next mp-reader-header-action"
      onClick={() => goToStep(currentTopicIndex + 1)}
    >
      {currentTopicIndex === topics.length - 1 ? 'Continue to practice' : 'Next session'}
      <span className="material-symbols-outlined" aria-hidden="true">arrow_forward</span>
    </button>
  );

  const renderPracticeForwardAction = () =>
    nextModule ? (
      <Link
        to={`/track/${track.id}/module/${nextModule.id}`}
        className="mp-reader-btn mp-reader-next mp-reader-finish mp-reader-header-action"
      >
        Next module
        <span className="material-symbols-outlined" aria-hidden="true">arrow_forward</span>
      </Link>
    ) : (
      <Link
        to={`/track/${track.id}`}
        className="mp-reader-btn mp-reader-next mp-reader-finish mp-reader-header-action"
      >
        Back to track
        <span className="material-symbols-outlined" aria-hidden="true">arrow_forward</span>
      </Link>
    );

  const renderTopicReaderNavBottom = () => (
    <div className="mp-reader-nav">
      <button
        type="button"
        className="mp-reader-btn mp-reader-prev"
        onClick={() => goToStep(currentTopicIndex - 1)}
        disabled={isFirstStep}
      >
        <span className="material-symbols-outlined" aria-hidden="true">arrow_back</span>
        Previous
      </button>
      <span className="mp-reader-progress">
        {currentTopicIndex + 1} / {totalSteps}
      </span>
      <button
        type="button"
        className="mp-reader-btn mp-reader-next"
        onClick={() => goToStep(currentTopicIndex + 1)}
      >
        {currentTopicIndex === topics.length - 1 ? 'Continue to practice' : 'Next session'}
        <span className="material-symbols-outlined" aria-hidden="true">arrow_forward</span>
      </button>
    </div>
  );

  const renderPracticeReaderNavBottom = () => (
    <div className="mp-reader-nav">
      <button
        type="button"
        className="mp-reader-btn mp-reader-prev"
        onClick={() => goToStep(currentTopicIndex - 1)}
        disabled={isFirstStep}
      >
        <span className="material-symbols-outlined" aria-hidden="true">arrow_back</span>
        Previous
      </button>
      <span className="mp-reader-progress">
        {totalSteps} / {totalSteps}
      </span>
      {nextModule ? (
        <Link
          to={`/track/${track.id}/module/${nextModule.id}`}
          className="mp-reader-btn mp-reader-next mp-reader-finish"
        >
          Next module
          <span className="material-symbols-outlined" aria-hidden="true">arrow_forward</span>
        </Link>
      ) : (
        <Link to={`/track/${track.id}`} className="mp-reader-btn mp-reader-next mp-reader-finish">
          Back to track
          <span className="material-symbols-outlined" aria-hidden="true">arrow_forward</span>
        </Link>
      )}
    </div>
  );

  const handleBold = () => wrapSelection(textareaRef, '**', '**', setNotesAndSave, triggerSave);
  const handleItalic = () => wrapSelection(textareaRef, '*', '*', setNotesAndSave, triggerSave);
  const handleBullet = () => insertBullet(textareaRef, setNotesAndSave, triggerSave);

  // Build step entries for the stepper
  const stepEntries = [
    ...topics.map((topic) => ({ id: topic.id, label: topic.label })),
    { id: '__practice__', label: 'Practice' },
  ];

  const sidebarLayoutClass =
    topics.length > 0
      ? sidebarOpen
        ? ' mp-layout--sidebar-expanded'
        : ' mp-layout--sidebar-collapsed'
      : '';

  return (
    <div className={`mp-main${sidebarLayoutClass}`}>
      {/* --- Header --- */}
      <header className="mp-header">
        <nav className="mp-nav" aria-label="Breadcrumb">
          <Link to="/curriculum">Curriculum</Link>
          <span className="material-symbols-outlined mp-nav-chevron" aria-hidden="true">chevron_right</span>
          <Link to={`/track/${trackId}`}>{track.label}</Link>
          <span className="material-symbols-outlined mp-nav-chevron" aria-hidden="true">chevron_right</span>
          <span className="mp-nav-current">{module.title}</span>
        </nav>
        <div className="mp-header-main">
          <div className="mp-header-copy">
            <p className="mp-eyebrow">{module.phase}</p>
            <h1 className="mp-title">{module.title}</h1>
            <p className="mp-description">{module.summary}</p>
          </div>
        </div>
      </header>

      {/* Progress error banner */}
      {progressError && (
        <div className="feedback-banner error" role="alert">
          <span>{progressError}</span>
          <button type="button" onClick={clearProgressError}>Dismiss</button>
        </div>
      )}
      <p className="sr-only" role="status" aria-live="polite">
        {progressStatusMessage}
      </p>

      {/* --- Layout: sidebar + content --- */}
      <div className="mp-layout">
        {/* Sidebar navigation */}
        {topics.length > 0 && (
          <nav className={`mp-sidebar${sidebarOpen ? '' : ' mp-sidebar-collapsed'}`} aria-label="Section navigation">
            <div className="mp-sidebar-header">
              {sidebarOpen && <span className="mp-sidebar-heading">Sections</span>}
              <button
                type="button"
                className="mp-sidebar-toggle"
                onClick={() => setSidebarOpen((prev) => !prev)}
                aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
                title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
              >
                <span className="material-symbols-outlined" aria-hidden="true">
                  {sidebarOpen ? 'left_panel_close' : 'left_panel_open'}
                </span>
              </button>
            </div>
            {sidebarOpen && (
              <ul className="mp-sidebar-list">
                {stepEntries.map((entry, idx) => (
                  <li key={entry.id}>
                    <button
                      type="button"
                      className={`mp-sidebar-item${idx === currentTopicIndex ? ' mp-sidebar-active' : ''}${idx < Math.max(currentTopicIndex, module.maxGuideStep ?? 0) ? ' mp-sidebar-done' : ''}`}
                      onClick={() => goToStep(idx)}
                    >
                      <span className="mp-sidebar-num">
                        {idx < topics.length ? idx + 1 : (
                          <span className="material-symbols-outlined" style={{ fontSize: 14 }} aria-hidden="true">fitness_center</span>
                        )}
                      </span>
                      <span className="mp-sidebar-label">{entry.label}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </nav>
        )}

        {/* Main content column */}
        <div className="mp-content">

      {/* --- Guide + Practice (paginated reader) --- */}
      <section className="mp-guide" aria-label="Study guide" ref={guideTopRef}>
        {contentLoading ? (
          <div className="mp-guide-bg" style={{ padding: 32 }}>
            <MarkdownRenderer content="" loading />
          </div>
        ) : contentError ? (
          <div className="mp-guide-bg" style={{ padding: 32 }}>
            <MarkdownRenderer content="" error="Unable to load module content right now." />
          </div>
        ) : topics.length > 0 ? (
          <>
            {/* Current step content */}
            {isPracticeStep ? (
              /* ── Practice step ── */
              <div className="mp-reader">
                <div className="mp-reader-header mp-reader-header--split">
                  <div className="mp-reader-header-text">
                    <span className="mp-reader-kicker">Step {totalSteps} of {totalSteps}</span>
                    <h2 className="mp-reader-title">Practice</h2>
                  </div>
                  <div className="mp-reader-header-actions">{renderPracticeForwardAction()}</div>
                </div>
                <div className="mp-reader-body">
                  {/* Deep Dive Resources */}
                  {readItems.length > 0 && (
                    <div className="mp-resources" style={{ marginBottom: 32 }}>
                      <p className="mp-resources-label">Deep Dive Resources</p>
                      <div className="mp-resources-grid">
                        {readItems.map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            className="mp-resource-link"
                            onClick={() => item.url && setPendingUrl(item.url)}
                          >
                            <div className={`mp-resource-icon mp-${item.type}`}>
                              <span className="material-symbols-outlined" aria-hidden="true">
                                {RESOURCE_ICON_MAP[item.type] ?? 'link'}
                              </span>
                            </div>
                            <div className="mp-resource-info">
                              <span className="mp-resource-title">{item.label}</span>
                              <span className="mp-resource-subtitle">{extractDomain(item.url)}</span>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Checkpoints */}
                  <div className="mp-practice-header" style={{ marginBottom: 16 }}>
                    <h3 className="mp-practice-title">Checkpoints</h3>
                    <span className="mp-practice-badge">{actionCompletedCount} of {actionItems.length}</span>
                  </div>
                  <div className="mp-checkpoints">
                    {actionItems.map((item) => {
                      const done = isCompleted(module.id, item.id);
                      const pending = isPending(module.id, item.id);

                      return (
                        <div
                          key={item.id}
                          className={`mp-checkpoint${done ? ' mp-done' : ''}${!done ? '-unchecked' : ''}${pending ? ' mp-pending' : ''}`}
                        >
                          <button
                            type="button"
                            className={done ? 'mp-checkbox-done' : 'mp-checkbox-empty'}
                            onClick={() => handleToggle(module.id, item.id, item.type, item.label)}
                            disabled={pending}
                            aria-label={`${done ? 'Unmark' : 'Mark'} "${item.label}" as complete`}
                          >
                            {done && (
                              <span className="material-symbols-outlined mp-check-icon" aria-hidden="true">check</span>
                            )}
                          </button>
                          <div className="mp-checkpoint-info">
                            <span className="mp-checkpoint-title">{item.label}</span>
                            {item.url && (
                              <span className="mp-checkpoint-hint">{extractDomain(item.url)}</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {renderPracticeReaderNavBottom()}
              </div>
            ) : currentTopic ? (
              /* ── Topic step ── */
              <div className="mp-reader">
                <div className="mp-reader-header mp-reader-header--split">
                  <div className="mp-reader-header-text">
                    <span className="mp-reader-kicker">Section {currentTopicIndex + 1} of {totalSteps}</span>
                    <h2 className="mp-reader-title">{currentTopic.label}</h2>
                  </div>
                  <div className="mp-reader-header-actions">{renderTopicForwardAction()}</div>
                </div>
                <div className="mp-reader-body">
                  <MarkdownRenderer content={currentTopic.study_guide_markdown} />
                </div>
                {renderTopicReaderNavBottom()}
              </div>
            ) : null}
          </>
        ) : (
          /* No topics — show resources + practice directly */
          <>
            <div className="mp-guide-bg" style={{ padding: 32 }}>
              <p className="mp-guide-text">
                No generated guide yet. Use the source links below to get started.
              </p>
            </div>
            {readItems.length > 0 && (
              <div className="mp-resources">
                <p className="mp-resources-label">Deep Dive Resources</p>
                <div className="mp-resources-grid">
                  {readItems.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className="mp-resource-link"
                      onClick={() => item.url && setPendingUrl(item.url)}
                    >
                      <div className={`mp-resource-icon mp-${item.type}`}>
                        <span className="material-symbols-outlined" aria-hidden="true">
                          {RESOURCE_ICON_MAP[item.type] ?? 'link'}
                        </span>
                      </div>
                      <div className="mp-resource-info">
                        <span className="mp-resource-title">{item.label}</span>
                        <span className="mp-resource-subtitle">{extractDomain(item.url)}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
            {actionItems.length > 0 && (
              <div className="mp-practice-card">
                <div className="mp-practice-header">
                  <h2 className="mp-practice-title">Practice</h2>
                  <span className="mp-practice-badge">{actionCompletedCount} of {actionItems.length}</span>
                </div>
                <div className="mp-checkpoints">
                  {actionItems.map((item) => {
                    const done = isCompleted(module.id, item.id);
                    const pending = isPending(module.id, item.id);
                    return (
                      <div
                        key={item.id}
                        className={`mp-checkpoint${done ? ' mp-done' : ''}${!done ? '-unchecked' : ''}${pending ? ' mp-pending' : ''}`}
                      >
                        <button
                          type="button"
                          className={done ? 'mp-checkbox-done' : 'mp-checkbox-empty'}
                          onClick={() => handleToggle(module.id, item.id, item.type, item.label)}
                          disabled={pending}
                          aria-label={`${done ? 'Unmark' : 'Mark'} "${item.label}" as complete`}
                        >
                          {done && (
                            <span className="material-symbols-outlined mp-check-icon" aria-hidden="true">check</span>
                          )}
                        </button>
                        <div className="mp-checkpoint-info">
                          <span className="mp-checkpoint-title">{item.label}</span>
                          {item.url && (
                            <span className="mp-checkpoint-hint">{extractDomain(item.url)}</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                {nextModule ? (
                  <Link to={`/track/${track.id}/module/${nextModule.id}`} className="mp-cta-btn">
                    Continue to next module
                    <span className="material-symbols-outlined mp-cta-icon" aria-hidden="true">arrow_forward</span>
                  </Link>
                ) : (
                  <Link to={`/track/${track.id}`} className="mp-cta-btn">
                    Back to track overview
                    <span className="material-symbols-outlined mp-cta-icon" aria-hidden="true">arrow_forward</span>
                  </Link>
                )}
              </div>
            )}
          </>
        )}
      </section>

      {/* --- Notes Editor Section --- */}
      <section className="mp-notes" aria-labelledby={notesHeadingId}>
        <div className="mp-notes-header">
          <div className="mp-notes-header-left">
            <h2 id={notesHeadingId} className="mp-notes-title">Your Study Notes</h2>
          </div>
          <div className="mp-notes-toolbar">
            <button type="button" className="mp-toolbar-btn" aria-label="Bold" title="Bold" onClick={handleBold}>
              <span className="material-symbols-outlined" aria-hidden="true">format_bold</span>
            </button>
            <button type="button" className="mp-toolbar-btn" aria-label="Italic" title="Italic" onClick={handleItalic}>
              <span className="material-symbols-outlined" aria-hidden="true">format_italic</span>
            </button>
            <div className="mp-toolbar-divider" />
            <button type="button" className="mp-toolbar-btn" aria-label="Bullet list" title="Bullet list" onClick={handleBullet}>
              <span className="material-symbols-outlined" aria-hidden="true">format_list_bulleted</span>
            </button>
            {/* Ask AI — commented out for now; will revisit as a chat interface
            <button type="button" className="mp-toolbar-action" aria-label="Ask AI">
              <span className="material-symbols-outlined" style={{ fontSize: 16 }} aria-hidden="true">auto_awesome</span>
              Ask AI
            </button>
            */}
          </div>
        </div>
        <p id={notesDescriptionId} className="sr-only">
          Keep mistakes, patterns, and follow-up links in one place for the next pass.
        </p>
        <p id={notesFieldHintId} className="sr-only">
          Autosaves after a short pause so you can keep moving.
        </p>
        <div className="mp-notes-body">
          <textarea
            ref={textareaRef}
            id="module-notes"
            value={notes}
            onChange={handleNotesChange}
            placeholder="Start typing your study notes here..."
            aria-describedby={`${notesDescriptionId} ${notesFieldHintId} ${notesStatusId}`}
            aria-label="Study notes"
            rows={8}
          />
        </div>
        <p id={notesStatusId} className="sr-only" role="status" aria-live="polite">
          {saveStatusAnnouncement}
        </p>
      </section>

        </div>{/* end mp-content */}
      </div>{/* end mp-layout */}

      {/* External link confirmation modal */}
      {pendingUrl && (
        <ExternalLinkModal
          url={pendingUrl}
          onConfirm={() => setPendingUrl(null)}
          onCancel={() => setPendingUrl(null)}
        />
      )}

      {/* Module completion celebration */}
      {showCompletion && (
        <ModuleCompletionModal
          moduleTitle={module.title}
          checksDone={completedCount}
          nextModuleId={nextModule?.id ?? null}
          nextModuleTitle={nextModule?.title ?? null}
          trackId={track.id}
          onClose={() => setShowCompletion(false)}
        />
      )}
    </div>
  );
}
