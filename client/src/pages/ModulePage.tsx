import { useEffect, useId, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useCurriculum, useModuleContent } from '../hooks/useCurriculum.js';
import { useProgress } from '../hooks/useProgress.js';
import { api } from '../api/client.js';
import { MarkdownRenderer } from '../components/MarkdownRenderer.js';
import { ModuleItemList } from '../components/ModuleItemList.js';
import { ModuleCompletionModal } from '../components/ModuleCompletionModal.js';
import { ReadDoTabs } from '../components/ReadDoTabs.js';

const MODULE_STATUS_LABELS = {
  done: 'Done',
  'in-progress': 'In progress',
  available: 'Available',
  'soft-locked': 'Locked',
};

export function ModulePage() {
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
  const [openTopicId, setOpenTopicId] = useState<string | null>(null);
  const [showCompletion, setShowCompletion] = useState(false);

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

  const topics = moduleContent?.topics ?? [];

  useEffect(() => {
    if (topics.length === 0) {
      setOpenTopicId(null);
      return;
    }

    setOpenTopicId((current) => {
      if (current && topics.some((topic) => topic.id === current)) {
        return current;
      }
      return topics[0].id;
    });
  }, [moduleId, topics]);

  if (curriculumLoading) return <div className="loading" role="status" aria-live="polite">Loading...</div>;
  if (curriculumError) return <div className="error" role="alert">Error: {curriculumError}</div>;
  if (!curriculum || !trackId || !moduleId) return null;

  const track = curriculum.tracks.find((candidate) => candidate.id === trackId);
  const module = curriculum.modules.find(
    (candidate) => candidate.id === moduleId && candidate.track === trackId
  );

  if (!track || !module) {
    return <div className="error" role="alert">Module not found.</div>;
  }

  if (module.status === 'soft-locked') {
    const firstBlockerId = module.blockedBy[0] ?? null;
    const blockerModule = firstBlockerId
      ? curriculum.modules.find((candidate) => candidate.id === firstBlockerId) ?? null
      : null;
    const blockerPct = blockerModule && blockerModule.totalItems > 0
      ? Math.round((blockerModule.completedItems / blockerModule.totalItems) * 100)
      : 0;

    return (
      <div className="locked-page">
        <div className="locked-content surface-card">
          <p className="panel-label">Step-by-Step Mastery</p>
          <h1 className="locked-title">Patience is part of the process.</h1>
          <p className="locked-body">
            Before we dive into the complexities of <strong>{module.title}</strong>,
            your foundation needs a little more strength.
            Deep understanding requires a solid core.
          </p>

          {blockerModule && (
            <div className="locked-prereq surface-card">
              <p className="panel-label">Prerequisite Module</p>
              <div className="locked-prereq-row">
                <div className="locked-prereq-info">
                  <strong className="locked-prereq-title">{blockerModule.title}</strong>
                  <div className="progress-bar" style={{ marginTop: '0.5rem' }}>
                    <div className="progress-fill" style={{ width: `${blockerPct}%` }} />
                  </div>
                  <p className="locked-prereq-pct">
                    Completion progress: {blockerPct}%
                  </p>
                </div>
                <Link
                  to={`/track/${track.id}/module/${blockerModule.id}`}
                  className="primary-action locked-prereq-btn"
                >
                  Complete Prerequisite →
                </Link>
              </div>
            </div>
          )}

          <div className="locked-actions">
            <Link to={`/track/${track.id}`} className="secondary-link">
              View Syllabus
            </Link>
          </div>

          <p className="locked-mantra">- THE MINDFUL WAY IS THE STEADY WAY -</p>
        </div>
      </div>
    );
  }

  const trackModules = curriculum.modules.filter((candidate) => candidate.track === trackId);
  const currentIndex = trackModules.findIndex((candidate) => candidate.id === moduleId);
  const prevModule = currentIndex > 0 ? trackModules[currentIndex - 1] : null;
  const nextModule = currentIndex >= 0 && currentIndex < trackModules.length - 1
    ? trackModules[currentIndex + 1]
    : null;

  const items = moduleContent?.items ?? module.items;
  const readItems = items.filter((item) => item.type === 'read');
  const actionItems = items.filter((item) => item.type !== 'read');
  const completedCount = items.filter((item) => isCompleted(module.id, item.id)).length;
  const completionPct = items.length > 0 ? Math.round((completedCount / items.length) * 100) : 0;
  const noGeneratedContent = !contentLoading && !contentError && topics.length === 0;
  const saveStatusLabel = saveStatus === 'saving'
    ? 'Saving...'
    : saveStatus === 'saved'
      ? 'Saved'
      : saveStatus === 'error'
        ? saveError
        : 'Autosave on';
  const saveStatusAnnouncement = saveStatus === 'saving'
    ? 'Saving notes.'
    : saveStatus === 'saved'
      ? 'Notes saved.'
      : saveStatus === 'error'
        ? saveError
        : '';
  const defaultWorkspaceTab = topics.length > 0 ? 'read' : 'do';
  const readPanelHeading = topics.length > 0 ? 'Guide and study notes' : 'Resources to review';
  const readPanelBadge = topics.length > 0 ? `${topics.length} topics` : `${readItems.length} resources`;
  const workspaceReadLabel = topics.length > 0 ? 'Guide' : 'Resources';

  useEffect(() => {
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
  }, [completionPct]);

  const handleToggle = async (
    targetModuleId: string,
    itemId: string,
    itemType: 'read' | 'do' | 'check',
    label: string
  ) => {
    completionTriggeredByUserRef.current = true;
    await toggle(targetModuleId, itemId, itemType, label);
  };

  const readColumn = (
    <section className="content-panel read-column">
      <div className="content-panel-header">
        <div>
          <p className="panel-label">{workspaceReadLabel}</p>
          <h2>{readPanelHeading}</h2>
        </div>
        <span className="panel-badge">{readPanelBadge}</span>
      </div>
      {contentLoading ? (
        <MarkdownRenderer content="" loading />
      ) : contentError ? (
        <MarkdownRenderer
          content=""
          error="Unable to load module content right now."
        />
      ) : noGeneratedContent ? (
        <>
          <p className="content-intro">
            No generated guide yet. Use the source links below as the lightweight version for now.
          </p>
          <MarkdownRenderer content="" />
        </>
      ) : (
        <div className="topic-stack" role="list" aria-label="Guide topics">
          {topics.map((topic) => {
            const isOpen = openTopicId === topic.id;
            const panelId = `${topic.id}-panel`;

            return (
              <section
                key={topic.id}
                className={`topic-section topic-card${isOpen ? ' open' : ''}`}
                role="listitem"
              >
                <button
                  type="button"
                  className="topic-toggle"
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                  onClick={() => setOpenTopicId(isOpen ? null : topic.id)}
                >
                  <span className="topic-toggle-copy">
                    <span className="topic-toggle-kicker">Topic</span>
                    <span className="topic-toggle-title">{topic.label}</span>
                  </span>
                  <span className="topic-toggle-icon" aria-hidden="true">{isOpen ? '−' : '+'}</span>
                </button>
                {isOpen && (
                  <div id={panelId} className="topic-panel">
                    <MarkdownRenderer
                      content={topic.study_guide_markdown}
                    />
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
      <div className="go-deeper">
        <div className="section-copy-block">
          <p className="panel-label">Go deeper</p>
          <p className="content-intro">Keep source material and external explainers tucked underneath the guide.</p>
        </div>
        <ModuleItemList
          items={items}
          moduleId={module.id}
          isCompleted={isCompleted}
          isPending={isPending}
          onToggle={handleToggle}
          filter={['read']}
        />
      </div>
    </section>
  );

  const doColumn = (
    <section className="content-panel do-column">
      <div className="content-panel-header">
        <div>
          <p className="panel-label">Practice</p>
          <h2>Practice and checkpoints</h2>
        </div>
        <span className="panel-badge">{actionItems.length} actions</span>
      </div>
      <p className="content-intro">
        Work through the active checklist instead of juggling a guide and assignments side by side.
      </p>
      <ModuleItemList
        items={items}
        moduleId={module.id}
        isCompleted={isCompleted}
        isPending={isPending}
        onToggle={handleToggle}
        filter={['do', 'check']}
      />
    </section>
  );

  return (
    <div className="module-page">
      <section className="module-hero surface-card" data-track={track.id}>
        <div className="module-hero-main">
          <Link to={`/track/${track.id}`} className="back-link">Back to {track.label}</Link>
          <div className="module-hero-badges">
            <span className="phase-pill">{module.phase}</span>
            <span className={`status-chip status-${module.status}`}>
              {MODULE_STATUS_LABELS[module.status]}
            </span>
          </div>
          <h1 className="module-page-title">{module.title}</h1>
          <p className="module-page-summary">{module.summary}</p>
          <div className="module-hero-meta">
            <div className="hero-metric">
              <span className="hero-metric-label">Time</span>
              <strong>{module.estimate}</strong>
            </div>
            <div className="hero-metric">
              <span className="hero-metric-label">Sessions</span>
              <strong>{module.sessions}</strong>
            </div>
            <div className="hero-metric">
              <span className="hero-metric-label">Items</span>
              <strong>{completedCount}/{items.length}</strong>
            </div>
            <div className="hero-metric">
              <span className="hero-metric-label">References</span>
              <strong>{readItems.length}</strong>
            </div>
          </div>
        </div>

        <div className="module-hero-side">
          <div className="module-progress-card">
            <span className="module-progress-label">Module progress</span>
            <strong className="module-progress-value">{completionPct}%</strong>
            <div className="progress-bar large">
              <div className="progress-fill" style={{ width: `${completionPct}%` }} />
            </div>
            <p className="module-progress-copy">
              {completedCount} of {items.length} items complete
            </p>
          </div>
          <div className="module-nav">
            {prevModule
              ? (
                  <Link to={`/track/${track.id}/module/${prevModule.id}`} className="nav-btn">
                    Previous module
                  </Link>
                )
              : <span className="nav-placeholder">Start of track</span>}
            {nextModule
              ? (
                  <Link
                    to={`/track/${track.id}/module/${nextModule.id}`}
                    className="nav-btn nav-btn-primary"
                  >
                    Next module
                  </Link>
                )
              : (
                  <span className="track-complete">
                    Track complete. <Link to="/">Switch tracks</Link>
                  </span>
                )}
          </div>
        </div>
      </section>

      {progressError && (
        <div className="feedback-banner error" role="alert">
          <span>{progressError}</span>
          <button type="button" onClick={clearProgressError}>Dismiss</button>
        </div>
      )}
      <p className="sr-only" role="status" aria-live="polite">
        {progressStatusMessage}
      </p>

      <div className="module-workspace">
        <div className="module-columns desktop-cols" aria-label="Study workspace">
          {readColumn}
          {doColumn}
        </div>
        <div className="mobile-tabs">
          <ReadDoTabs
            key={`${module.id}-${defaultWorkspaceTab}`}
            readContent={readColumn}
            doContent={doColumn}
            readLabel={workspaceReadLabel}
            doLabel="Practice"
            defaultActive={defaultWorkspaceTab}
            ariaLabel="Study workspace"
          />
        </div>
      </div>

      <section className="notes-section surface-card">
        <div className="notes-header">
          <div>
            <p className="panel-label">Notes</p>
            <h2 id={notesHeadingId}>Capture the weak spots while they are fresh</h2>
          </div>
          <span className={`save-badge${saveStatus === 'error' ? ' error' : ''}`} aria-hidden="true">
            {saveStatusLabel}
          </span>
        </div>
        <p id={notesDescriptionId} className="notes-copy">
          Keep mistakes, patterns, and follow-up links in one place for the next pass.
        </p>
        <label htmlFor="module-notes" className="field-label notes-field-label">Study notes</label>
        <p id={notesFieldHintId} className="field-hint">
          Autosaves after a short pause so you can keep moving.
        </p>
        <textarea
          id="module-notes"
          value={notes}
          onChange={handleNotesChange}
          placeholder="Capture weak spots, patterns, or links..."
          aria-describedby={`${notesDescriptionId} ${notesFieldHintId} ${notesStatusId}`}
          rows={6}
        />
        <p id={notesStatusId} className="sr-only" role="status" aria-live="polite">
          {saveStatusAnnouncement}
        </p>
      </section>
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
