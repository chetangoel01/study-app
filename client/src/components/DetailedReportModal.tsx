import { useEffect, useMemo } from 'react';
import { usePracticeStats } from '../hooks/usePractice.js';
import type { PracticeSessionSummary, SkillBreakdownItem } from '../types.js';
import type { MasterySection } from '../lib/practiceMastery.js';

interface Props {
  onClose: () => void;
  skillBreakdown?: SkillBreakdownItem[];
  sections?: MasterySection[];
}

function clampPercent(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)));
}

function getBand(score: number): 'strong' | 'building' | 'early' {
  if (score >= 80) return 'strong';
  if (score >= 45) return 'building';
  return 'early';
}

function getBandLabel(score: number): string {
  const band = getBand(score);
  if (band === 'strong') return 'Strong';
  if (band === 'building') return 'Building';
  return 'Early';
}

function formatSessionTime(iso: string): string {
  const stamp = new Date(iso);
  if (Number.isNaN(stamp.getTime())) return 'Unknown time';
  return stamp.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function getSessionTypeLabel(session: PracticeSessionSummary): string {
  if (session.type === 'daily_challenge') return 'Daily Challenge';
  return session.title || 'Practice Session';
}

function formatTrendDate(isoDay: string): string {
  const parsed = new Date(`${isoDay}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return isoDay;
  return parsed.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function formatTopicTag(tag: string): string {
  return tag
    .split(/[_\s-]+/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function DetailedReportModal({ onClose, skillBreakdown, sections }: Props) {
  const { data: stats, loading } = usePracticeStats();
  const fallbackSkills = skillBreakdown && skillBreakdown.length > 0
    ? skillBreakdown
    : (stats?.skillBreakdown || []);

  const normalizedSections = useMemo<MasterySection[]>(() => {
    if (sections && sections.length > 0) {
      return sections.map((section) => ({
        ...section,
        score: clampPercent(section.score),
      }));
    }

    return fallbackSkills.map((skill) => ({
      key: skill.name.toLowerCase().includes('system')
        ? 'system-design'
        : skill.name.toLowerCase().includes('concurrency')
          ? 'concurrency'
          : 'algorithms',
      name: skill.name,
      score: clampPercent(skill.score),
      done: 0,
      total: 0,
      modules: [],
    }));
  }, [fallbackSkills, sections]);

  const averageScore = normalizedSections.length > 0
    ? Math.round(normalizedSections.reduce((sum, section) => sum + section.score, 0) / normalizedSections.length)
    : 0;

  const strongestArea = normalizedSections.length > 0
    ? [...normalizedSections].sort((a, b) => b.score - a.score)[0]
    : null;

  const focusArea = normalizedSections.length > 0
    ? [...normalizedSections].sort((a, b) => a.score - b.score)[0]
    : null;

  const sectionsWithCheckpoints = normalizedSections.filter((section) => section.total > 0);
  const completionSignal = sectionsWithCheckpoints.length > 0
    ? Math.round(
        (sectionsWithCheckpoints.reduce((sum, section) => sum + section.done, 0)
          / sectionsWithCheckpoints.reduce((sum, section) => sum + section.total, 0))
        * 100,
      )
    : averageScore;

  const recentSessions = (stats?.recentSessions || []).slice(0, 4);
  const quizAnalytics = stats?.quizAnalytics;
  const hasQuizAnalytics = (quizAnalytics?.totalAttempts ?? 0) > 0;

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-panel report-modal" onClick={(e) => e.stopPropagation()}>
        <div className="report-shell">
          <div className="report-header">
            <div className="report-header-copy">
              <p className="report-kicker">Practice Intelligence</p>
              <h2>Cognitive Mastery Report</h2>
              <p className="report-intro">
                Progress is now split into core areas and finer subsections so you can see where to push next.
              </p>
            </div>
            <button className="report-close-btn" onClick={onClose}>Close</button>
          </div>

        {loading ? (
          <div className="report-loading">Analyzing skills...</div>
        ) : (
          <>
            <section className="report-metrics-grid" aria-label="Mastery Summary">
              <article className="report-metric-card">
                <p className="report-metric-label">Average Mastery</p>
                <p className="report-metric-value">{averageScore}%</p>
              </article>
              <article className="report-metric-card">
                <p className="report-metric-label">Strongest Area</p>
                <p className="report-metric-value">{strongestArea?.name || 'No data'}</p>
              </article>
              <article className="report-metric-card">
                <p className="report-metric-label">Completion Signal</p>
                <p className="report-metric-value">{completionSignal}%</p>
              </article>
            </section>

            <section className="report-section">
              <div className="report-section-head">
                <h3>Quiz Calibration</h3>
              </div>
              {hasQuizAnalytics ? (
                <>
                  <div className="report-quiz-summary">
                    <article className="report-quiz-stat">
                      <p className="report-quiz-label">Overall Accuracy</p>
                      <p className="report-quiz-value">{quizAnalytics?.overallAccuracy ?? 0}%</p>
                    </article>
                    <article className="report-quiz-stat">
                      <p className="report-quiz-label">Attempts</p>
                      <p className="report-quiz-value">{quizAnalytics?.totalAttempts ?? 0}</p>
                    </article>
                    <article className="report-quiz-stat">
                      <p className="report-quiz-label">Questions Graded</p>
                      <p className="report-quiz-value">{quizAnalytics?.totalQuestions ?? 0}</p>
                    </article>
                  </div>

                  <div className="report-quiz-grid">
                    <article className="report-quiz-card">
                      <h4>By Difficulty</h4>
                      <div className="report-quiz-list">
                        {(quizAnalytics?.byDifficulty ?? []).map((entry) => (
                          <div className="report-quiz-row" key={entry.difficulty}>
                            <span>{entry.difficulty}</span>
                            <span>{entry.accuracy}% ({entry.questions})</span>
                          </div>
                        ))}
                      </div>
                    </article>

                    <article className="report-quiz-card">
                      <h4>By Mode</h4>
                      <div className="report-quiz-list">
                        {(quizAnalytics?.byMode ?? []).length > 0 ? (
                          (quizAnalytics?.byMode ?? []).map((entry) => (
                            <div className="report-quiz-row" key={entry.mode}>
                              <span>{entry.label}</span>
                              <span>{entry.accuracy}% ({entry.attempts})</span>
                            </div>
                          ))
                        ) : (
                          <p className="report-empty">No mode-level quiz data yet.</p>
                        )}
                      </div>
                    </article>
                  </div>

                  <article className="report-quiz-card">
                    <h4>Accuracy Trend</h4>
                    {(quizAnalytics?.accuracyTrend ?? []).length > 0 ? (
                      <div className="report-trend-list">
                        {(quizAnalytics?.accuracyTrend ?? []).map((point) => (
                          <div key={`${point.date}-${point.attempts}`} className="report-trend-row">
                            <span>{formatTrendDate(point.date)}</span>
                            <div className="report-trend-meter">
                              <div style={{ width: `${point.accuracy}%` }} />
                            </div>
                            <span>{point.accuracy}%</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="report-empty">Complete more sessions to populate trend data.</p>
                    )}
                  </article>

                  <article className="report-quiz-card">
                    <h4>Weak Topics To Revisit</h4>
                    {(quizAnalytics?.weakTopics ?? []).length > 0 ? (
                      <div className="report-quiz-list">
                        {(quizAnalytics?.weakTopics ?? []).map((topic) => (
                          <div className="report-quiz-row" key={topic.tag}>
                            <span>{formatTopicTag(topic.tag)}</span>
                            <span>{topic.accuracy}% • {topic.misses} misses</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="report-empty">Weak-topic signals appear after more tagged attempts.</p>
                    )}
                  </article>
                </>
              ) : (
                <p className="report-empty">
                  Complete a few quiz attempts and this report will calibrate your mastery with difficulty and topic-level insights.
                </p>
              )}
            </section>

            <section className="report-section">
              <div className="report-section-head">
                <h3>Core Areas</h3>
              </div>
              <div className="report-core-grid">
                {normalizedSections.map((section) => (
                  <article className="report-core-card" key={`${section.key}-${section.name}`}>
                    <div className="report-core-header">
                      <h4>{section.name}</h4>
                      <span className={`report-pill ${getBand(section.score)}`}>{getBandLabel(section.score)}</span>
                    </div>
                    <div className="report-core-score">
                      <strong>{section.score}%</strong>
                      {section.total > 0 ? (
                        <span>
                          {section.done}/{section.total} checkpoints
                        </span>
                      ) : (
                        <span>No checkpoints yet</span>
                      )}
                    </div>
                    <div className="report-progress-track" role="presentation">
                      <div className="report-progress-fill" style={{ width: `${section.score}%` }} />
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <section className="report-section">
              <div className="report-section-head">
                <h3>Subsections</h3>
                {focusArea ? (
                  <p className="report-section-note">
                    Focus next: <strong>{focusArea.name}</strong>
                  </p>
                ) : null}
              </div>
              <div className="report-subsection-grid">
                {normalizedSections.map((section) => (
                  <article className="report-subsection-card" key={`${section.key}-${section.name}-details`}>
                    <div className="report-subsection-head">
                      <h4>{section.name}</h4>
                      <span>{section.modules.length} modules</span>
                    </div>
                    {section.modules.length > 0 ? (
                      <div className="report-module-stack">
                        {section.modules.slice(0, 4).map((module) => (
                          <div className="report-module-card" key={module.id}>
                            <div className="report-module-row">
                              <div className="report-module-copy">
                                <span className="report-module-title">{module.title}</span>
                                <span className="report-module-meta">
                                  {module.done}/{module.total} checkpoints
                                </span>
                              </div>
                              <span className="report-module-score">{module.score}%</span>
                            </div>
                            <div className="report-module-track" role="presentation">
                              <div className="report-module-fill" style={{ width: `${module.score}%` }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="report-empty">No modules mapped yet for this area.</p>
                    )}
                  </article>
                ))}
              </div>
            </section>

            <section className="report-section">
              <div className="report-section-head">
                <h3>Recent Signals</h3>
              </div>
              {recentSessions.length > 0 ? (
                <div className="report-signal-list">
                  {recentSessions.map((session) => (
                    <article className="report-signal-row" key={session.id}>
                      <div>
                        <p className="report-signal-title">{getSessionTypeLabel(session)}</p>
                        <p className="report-signal-meta">{formatSessionTime(session.createdAt)}</p>
                      </div>
                      <p className="report-signal-score">{clampPercent(session.score)}%</p>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="report-empty">Complete a few sessions to populate this panel.</p>
              )}
            </section>
          </>
        )}
        </div>
      </div>
    </div>
  );
}
