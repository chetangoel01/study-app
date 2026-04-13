import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MockInterviewModal } from '../components/MockInterviewModal.js';
import { useCurriculum } from '../hooks/useCurriculum.js';
import { useDailyChallenge, usePracticeStats, useMockPeers } from '../hooks/usePractice.js';
import type { SkillBreakdownItem } from '../types.js';
import {
  buildMasterySections,
  sectionsToSkillBreakdown,
} from '../lib/practiceMastery.js';

type TopicPracticeMode = 'dsa' | 'system-design' | 'concurrency';

const topicPracticeConfig: Record<
  TopicPracticeMode,
  {
    label: string;
    description: string;
    tags: string[];
    cta: string;
    trackId: string;
    moduleId: string;
    mode: string;
    difficulty: 'Easy' | 'Medium' | 'Hard';
    duration: number;
  }
> = {
  dsa: {
    label: 'DSA Drills',
    description: 'Solve interview-style coding drills with a tight feedback loop.',
    tags: ['Arrays', 'Graphs', 'DP'],
    cta: 'Start DSA Drill',
    trackId: 'dsa-leetcode',
    moduleId: 'dsa-drills',
    mode: 'dsa',
    difficulty: 'Medium',
    duration: 45,
  },
  'system-design': {
    label: 'System Design MCQs',
    description: 'Practice tradeoff thinking with quick multiple-choice architecture prompts.',
    tags: ['Scalability', 'Caching', 'Reliability'],
    cta: 'Launch MCQ Set',
    trackId: 'system-design',
    moduleId: 'system-design-mcq',
    mode: 'system-design-mcq',
    difficulty: 'Medium',
    duration: 30,
  },
  concurrency: {
    label: 'Concurrency Open Response',
    description: 'Answer short prompts on race conditions, locks, and thread coordination.',
    tags: ['Threads', 'Locks', 'Race Conditions'],
    cta: 'Open Concurrency Prompt',
    trackId: 'concurrency',
    moduleId: 'concurrency-open',
    mode: 'concurrency-open',
    difficulty: 'Medium',
    duration: 30,
  },
};

export function PracticePage() {
  const navigate = useNavigate();
  const [showMockModal, setShowMockModal] = useState(false);
  const [mockFeedback, setMockFeedback] = useState('');
  const [topicPracticeMode, setTopicPracticeMode] = useState<TopicPracticeMode>('dsa');
  const { data: curriculum } = useCurriculum();
  const { data: dailyChallenge } = useDailyChallenge();
  const { data: stats } = usePracticeStats();
  const { peers, scheduleMock, proposeAvailability } = useMockPeers();
  const activeTopicPractice = topicPracticeConfig[topicPracticeMode];
  const visiblePeers = peers.slice(0, 2);
  const extraPeers = Math.max(0, peers.length - visiblePeers.length);
  const streakDays = stats?.streakDays ?? 0;
  const streakWeek = stats?.streakWeek ?? Array.from({ length: 7 }, () => false);
  const masterySections = useMemo(
    () => buildMasterySections(curriculum?.modules ?? []),
    [curriculum?.modules],
  );
  const cognitiveMastery = useMemo<SkillBreakdownItem[]>(() => {
    if ((curriculum?.modules ?? []).length === 0) {
      return stats?.skillBreakdown ?? [];
    }
    return sectionsToSkillBreakdown(masterySections);
  }, [curriculum?.modules, masterySections, stats?.skillBreakdown]);

  const launchTopicPractice = () => {
    if (topicPracticeMode === 'dsa' && dailyChallenge?.id) {
      navigate(`/practice/challenge/${dailyChallenge.id}`);
      return;
    }

    const params = new URLSearchParams({
      trackId: activeTopicPractice.trackId,
      moduleId: activeTopicPractice.moduleId,
      mode: activeTopicPractice.mode,
      difficulty: activeTopicPractice.difficulty,
      duration: String(activeTopicPractice.duration),
    });
    navigate(`/practice/session?${params.toString()}`);
  };

  const formatFriendlyDate = (iso: string) =>
    new Date(iso).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });

  return (
    <div className="practice-page-container">
      {/* Welcome & Focus Section */}
      <div className="practice-header-section">
        <h1>Deep Practice</h1>
        <p className="practice-subtitle">
          Sharpen your knowledge in DSA, System Design, or Concurrency through targeted drills.
        </p>
      </div>

      <div className="practice-layout">
        {/* Main Practice Modes - Asymmetric Bento Grid */}
        <div className="practice-main-column">
          
          {/* Daily Challenge Hero */}
          <div className="practice-daily-hero">
            <div className="practice-daily-blur"></div>
            <div className="practice-daily-content">
              <div className="practice-daily-top">
                <span className="practice-daily-badge">DAILY CHALLENGE</span>
                <h2>{dailyChallenge?.title || 'No challenge today'}</h2>
                <p>
                  {dailyChallenge?.descriptionMarkdown
                    ? dailyChallenge.descriptionMarkdown.replace(/^#+\s.*\n?/, '').slice(0, 120) + '…'
                    : dailyChallenge
                    ? 'Open on LeetCode to get started.'
                    : 'Check back later — challenges are seeded daily.'}
                </p>
              </div>
              <div className="practice-daily-bottom">
                <button
                  className={`practice-btn-solve ${dailyChallenge?.completed ? 'completed' : ''} ${!dailyChallenge?.id ? 'disabled' : ''}`}
                  disabled={!dailyChallenge?.id || dailyChallenge?.completed}
                  onClick={() => {
                    if (dailyChallenge?.id) {
                      navigate(`/practice/challenge/${dailyChallenge.id}`);
                    }
                  }}
                >
                  {dailyChallenge?.completed ? 'Completed ✓' : dailyChallenge?.id ? 'Solve Challenge' : 'Coming Soon'}
                  {!dailyChallenge?.completed && dailyChallenge?.id && <span className="practice-btn-icon">→</span>}
                </button>
                <div className="practice-daily-meta">
                  <span className="meta-dot"></span>
                  <span>{dailyChallenge?.difficulty || 'Medium'}</span>
                  <span className="meta-dot"></span>
                  <span>{dailyChallenge?.durationMins || 35} mins</span>
                </div>
              </div>
            </div>
            <div className="practice-daily-abstract-icon" aria-hidden="true">
              <svg width="120" height="94" viewBox="0 0 120 94" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path opacity="0.2" d="M10.7692 93.3334C7.70087 93.3334 5.1389 92.3056 3.08334 90.2501C1.02778 88.1945 0 85.6326 0 82.5642V10.7692C0 7.70087 1.02778 5.1389 3.08334 3.08333C5.1389 1.02778 7.70087 0 10.7692 0H109.231C112.299 0 114.861 1.02778 116.917 3.08333C118.972 5.1389 120 7.70087 120 10.7692V82.5642C120 85.6326 118.972 88.1945 116.917 90.2501C114.861 92.3056 112.299 93.3334 109.231 93.3334H10.7692ZM10.7692 86.6667H109.231C110.256 86.6667 111.197 86.2394 112.051 85.3847C112.906 84.53 113.333 83.5898 113.333 82.5642V20H6.66671V82.5642C6.66671 83.5898 7.09406 84.53 7.94875 85.3847C8.80345 86.2394 9.74361 86.6667 10.7692 86.6667ZM30 75.2565L25.4103 70.6667L42.5769 53.3334L25.2436 36L30 31.4103L51.9231 53.3334L30 75.2565ZM63.3334 76.6667V70H96.6667V76.6667H63.3334Z" fill="#FAF8FF" />
              </svg>
            </div>
          </div>

          {/* Specific Practice Categories */}
          <div className="practice-categories">
            {/* DSA */}
            <div className="practice-category-card dsa-card">
              <div className="category-icon-bg dsa-bg">
                <div className="category-icon dsa-icon" aria-hidden="true">
                  <svg width="56" height="56" viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect width="56" height="56" rx="16" fill="#DDE1F9" />
                    <path d="M31.75 39.25V35.5H26.75V23H24.25V26.75H15.5V16.75H24.25V20.5H31.75V16.75H40.5V26.75H31.75V23H29.25V33H31.75V29.25H40.5V39.25H31.75ZM18 19.25V24.25V19.25ZM34.25 31.75V36.75V31.75ZM34.25 19.25V24.25V19.25ZM34.25 24.25H38V19.25H34.25V24.25ZM34.25 36.75H38V31.75H34.25V36.75ZM18 24.25H21.75V19.25H18V24.25Z" fill="#4C5164" />
                  </svg>
                </div>
              </div>
              <h3>Topic-Specific</h3>
              <div className="topic-mode-switch" role="tablist" aria-label="Topic-specific practice mode">
                {(Object.keys(topicPracticeConfig) as TopicPracticeMode[]).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    role="tab"
                    aria-selected={topicPracticeMode === mode}
                    className={`topic-mode-pill${topicPracticeMode === mode ? ' active' : ''}`}
                    onClick={() => setTopicPracticeMode(mode)}
                  >
                    {topicPracticeConfig[mode].label}
                  </button>
                ))}
              </div>
              <p>{activeTopicPractice.description}</p>
              <div className="category-tags">
                {activeTopicPractice.tags.map((tag) => (
                  <span key={tag} className="category-tag">{tag}</span>
                ))}
              </div>
              <button 
                className="category-btn dsa-btn"
                onClick={launchTopicPractice}
              >
                {activeTopicPractice.cta} <span className="btn-arrow">→</span>
              </button>
            </div>

            {/* Mock Interviews */}
            <div className="practice-category-card mock-card">
              <div className="category-icon-bg mock-bg">
                <div className="category-icon mock-icon" aria-hidden="true">
                  <svg width="56" height="56" viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect width="56" height="56" rx="16" fill="#E1C4F3" />
                    <path d="M23 30.5H30.5C30.8542 30.5 31.151 30.3802 31.3906 30.1406C31.6302 29.901 31.75 29.6042 31.75 29.25V26.75L34.25 29.25V21.75L31.75 24.25V21.75C31.75 21.3958 31.6302 21.099 31.3906 20.8594C31.151 20.6198 30.8542 20.5 30.5 20.5H23C22.6458 20.5 22.349 20.6198 22.1094 20.8594C21.8698 21.099 21.75 21.3958 21.75 21.75V29.25C21.75 29.6042 21.8698 29.901 22.1094 30.1406C22.349 30.3802 22.6458 30.5 23 30.5ZM15.5 40.5V18C15.5 17.3125 15.7448 16.724 16.2344 16.2344C16.724 15.7448 17.3125 15.5 18 15.5H38C38.6875 15.5 39.276 15.7448 39.7656 16.2344C40.2552 16.724 40.5 17.3125 40.5 18V33C40.5 33.6875 40.2552 34.276 39.7656 34.7656C39.276 35.2552 38.6875 35.5 38 35.5H20.5L15.5 40.5ZM19.4375 33H38V18H18V34.4062L19.4375 33ZM18 33V18V33Z" fill="#523D63" />
                  </svg>
                </div>
              </div>
              <h3>Mock Interviews</h3>
              <p>Simulate real-world pressure with AI-led or peer-to-peer technical interviews.</p>
              <div className="mock-peer-avatars">
                {visiblePeers.length > 0 ? (
                  visiblePeers.map((peer, index) => (
                    <div
                      key={peer.id}
                      className={`avatar peer-${index + 1}`}
                      title={peer.fullName}
                      aria-label={peer.fullName}
                    >
                      {peer.initials}
                    </div>
                  ))
                ) : (
                  <div className="avatar peer-placeholder" aria-hidden="true">--</div>
                )}
                {extraPeers > 0 ? (
                  <div className="avatar peer-empty"><span>+{extraPeers}</span></div>
                ) : null}
              </div>
              <p className="mock-peer-hint">
                {mockFeedback || (peers.length > 0
                  ? `Choose from ${peers.length} available peer${peers.length === 1 ? '' : 's'}.`
                  : 'No peers online right now. Propose your availability and get matched.')}
              </p>
              <button 
                className="category-btn mock-btn"
                onClick={() => setShowMockModal(true)}
              >
                Find a Peer <span className="btn-arrow">→</span>
              </button>
            </div>
          </div>

        </div>

        {/* Aside - Sidebar - Progress Stats */}
        <aside className="practice-sidebar">
          
          {/* Practice Streaks */}
          <div className="sidebar-card">
            <div className="sidebar-card-header">
              <div className="streak-icon" aria-hidden="true">
                <svg width="16" height="18" viewBox="0 0 16 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M0 11C0 9.25 0.416667 7.69167 1.25 6.325C2.08333 4.95833 3 3.80833 4 2.875C5 1.94167 5.91667 1.22917 6.75 0.7375C7.58333 0.245833 8 0 8 0V3.3C8 3.91667 8.20833 4.40417 8.625 4.7625C9.04167 5.12083 9.50833 5.3 10.025 5.3C10.3083 5.3 10.5792 5.24167 10.8375 5.125C11.0958 5.00833 11.3333 4.81667 11.55 4.55L12 4C13.2 4.7 14.1667 5.67083 14.9 6.9125C15.6333 8.15417 16 9.51667 16 11C16 12.4667 15.6417 13.8042 14.925 15.0125C14.2083 16.2208 13.2667 17.175 12.1 17.875C12.3833 17.475 12.6042 17.0375 12.7625 16.5625C12.9208 16.0875 13 15.5833 13 15.05C13 14.3833 12.875 13.7542 12.625 13.1625C12.375 12.5708 12.0167 12.0417 11.55 11.575L8 8.1L4.475 11.575C3.99167 12.0583 3.625 12.5917 3.375 13.175C3.125 13.7583 3 14.3833 3 15.05C3 15.5833 3.07917 16.0875 3.2375 16.5625C3.39583 17.0375 3.61667 17.475 3.9 17.875C2.73333 17.175 1.79167 16.2208 1.075 15.0125C0.358333 13.8042 0 12.4667 0 11ZM8 10.9L10.125 12.975C10.4083 13.2583 10.625 13.575 10.775 13.925C10.925 14.275 11 14.65 11 15.05C11 15.8667 10.7083 16.5625 10.125 17.1375C9.54167 17.7125 8.83333 18 8 18C7.16667 18 6.45833 17.7125 5.875 17.1375C5.29167 16.5625 5 15.8667 5 15.05C5 14.6667 5.075 14.2958 5.225 13.9375C5.375 13.5792 5.59167 13.2583 5.875 12.975L8 10.9Z" fill="#F97316" />
                </svg>
              </div>
              <h3>{streakDays} {streakDays === 1 ? 'Day' : 'Days'} Streak</h3>
            </div>
            <div className="streak-metric">
              <span className="streak-number">{stats?.percentile || 0}%</span>
              <span className="streak-label">UPPER</span>
            </div>
            <p className="sidebar-subtext">You're in the top {stats?.percentile || 0}% of mindful learners this month. Keep the momentum.</p>
            <div className="streak-tracker">
              {streakWeek.map((isActive, index) => (
                <div
                  key={`streak-${index}`}
                  className={`streak-day ${isActive ? 'active' : 'inactive'}`}
                ></div>
              ))}
            </div>
          </div>

          {/* Skill Breakdown */}
          <div className="sidebar-card">
            <div className="sidebar-card-header">
              <h3>Cognitive Mastery</h3>
            </div>
            <div className="skill-breakdown-list">
              {cognitiveMastery.length > 0 ? (
                cognitiveMastery.map((skill) => {
                  const score = Math.max(0, Math.min(100, Math.round(skill.score)));
                  return (
                    <div className="skill-row" key={skill.name}>
                      <div className="skill-labels">
                        <span className="skill-name">{skill.name}</span>
                        <span className="skill-score">{score}%</span>
                      </div>
                      <div className="skill-bar-track">
                        <div className="skill-bar-fill" style={{ width: `${score}%` }}></div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="skill-row">
                  <span className="skill-name truncate">Complete modules to unlock Cognitive Mastery</span>
                </div>
              )}
            </div>
          </div>

        </aside>
      </div>

      {showMockModal && (
        <MockInterviewModal
          peers={peers}
          onClose={() => setShowMockModal(false)}
          onSchedule={async ({ peerId, topic, scheduledFor }) => {
            await scheduleMock({ peerId, topic, scheduledFor });
            const peerName = peers.find((peer) => peer.id === peerId)?.fullName ?? 'your peer';
            setMockFeedback(`Invite sent to ${peerName} for ${formatFriendlyDate(scheduledFor)}.`);
          }}
          onProposeAvailability={async ({ proposedFor, durationMinutes, topic, notes }) => {
            await proposeAvailability({ proposedFor, durationMinutes, topic, notes });
            setMockFeedback(`Availability posted for ${formatFriendlyDate(proposedFor)} (${durationMinutes} min).`);
          }}
        />
      )}
    </div>
  );
}
