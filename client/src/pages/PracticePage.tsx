import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PracticeSetupModal } from '../components/PracticeSetupModal.js';
import { useCurriculum } from '../hooks/useCurriculum.js';
import { useDailyChallenge, usePracticeStats, useMockPeers } from '../hooks/usePractice.js';

export function PracticePage() {
  const navigate = useNavigate();
  const [showSetup, setShowSetup] = useState(false);
  const { data, loading, error } = useCurriculum();
  const { data: dailyChallenge, markComplete } = useDailyChallenge();
  const { data: stats } = usePracticeStats();
  const { peers, scheduleMock } = useMockPeers();

  const practiceModules = useMemo(() => {
    if (!data) return [];
    return data.modules
      .filter((module) => module.status === 'in-progress' || module.status === 'available')
      .map((module) => ({
        moduleId: module.id,
        title: module.title,
        trackId: module.track,
        trackLabel: data.tracks.find((track) => track.id === module.track)?.label ?? module.track,
        summary: module.summary,
        status: module.status,
      }));
  }, [data]);

  const handleBeginSession = ({
    moduleId,
    trackId,
  }: {
    moduleId: string;
    trackId: string;
    difficulty: 'Easy' | 'Medium' | 'Hard';
    duration: number;
  }) => {
    navigate(`/track/${trackId}/module/${moduleId}`);
  };

  if (loading) return <div className="loading" role="status" aria-live="polite">Loading practice...</div>;
  if (error) return <div className="error" role="alert">{error}</div>;

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
                <h2>{dailyChallenge?.title || 'Optimal Partitioning of Strings'}</h2>
                <p>Given a string s, partition the string into substrings such that...</p>
              </div>
              <div className="practice-daily-bottom">
                <button 
                  className={`practice-btn-solve ${dailyChallenge?.completed ? 'completed' : ''}`}
                 onClick={() => {
                   if (dailyChallenge?.leetcodeUrl) {
                     window.open(dailyChallenge.leetcodeUrl, '_blank');
                     markComplete();
                   }
                 }}
                >
                  {dailyChallenge?.completed ? 'Completed ✓' : 'Solve Challenge'}
                  {!dailyChallenge?.completed && <span className="practice-btn-icon">→</span>}
                </button>
                <div className="practice-daily-meta">
                  <span className="meta-dot"></span>
                  <span>{dailyChallenge?.difficulty || 'Medium'}</span>
                  <span className="meta-dot"></span>
                  <span>{dailyChallenge?.durationMins || 35} mins</span>
                </div>
              </div>
            </div>
            <div className="practice-daily-abstract-icon"></div>
          </div>

          {/* Specific Practice Categories */}
          <div className="practice-categories">
            {/* DSA */}
            <div className="practice-category-card dsa-card">
              <div className="category-icon-bg dsa-bg">
                <div className="category-icon dsa-icon"></div>
              </div>
              <h3>Topic-Specific</h3>
              <p>Sharpen your knowledge in DSA, System Design, or Concurrency through targeted drills.</p>
              <div className="category-tags">
                <span className="category-tag">Arrays</span>
                <span className="category-tag">Graphs</span>
                <span className="category-tag">DP</span>
              </div>
              <button 
                className="category-btn dsa-btn"
                onClick={() => setShowSetup(true)}
              >
                Configure <span className="btn-arrow">→</span>
              </button>
            </div>

            {/* Mock Interviews */}
            <div className="practice-category-card mock-card">
              <div className="category-icon-bg mock-bg">
                <div className="category-icon mock-icon"></div>
              </div>
              <h3>Mock Interviews</h3>
              <p>Simulate real-world pressure with AI-led or peer-to-peer technical interviews.</p>
              <div className="mock-peer-avatars">
                <div className="avatar peer-1">{peers[0]?.initials || ''}</div>
                <div className="avatar peer-2">{peers[1]?.initials || ''}</div>
                <div className="avatar peer-empty"><span>+{Math.max(0, peers.length - 2)}</span></div>
              </div>
              <button 
                className="category-btn mock-btn"
                onClick={() => {
                  if (peers.length > 0) {
                    scheduleMock(peers[0].id, 'Systems Design');
                    alert(`Scheduled mock interview with ${peers[0].fullName} for tomorrow!`);
                  } else {
                    alert('No peers available right now. Tell them to opt-in from Settings!');
                  }
                }}
              >
                Find a Peer <span className="btn-arrow">→</span>
              </button>
            </div>
          </div>

          {/* Recent Sessions Section */}
          <div className="practice-recent-sessions">
            <div className="recent-sessions-header">
              <h3>Recent Sessions</h3>
              <button className="view-all-btn">View All</button>
            </div>
            <div className="recent-sessions-list">
              {(stats?.recentSessions || []).length > 0 ? (
                stats.recentSessions.map((session: any) => (
                  <div key={session.id} className="recent-session-item">
                    <div className="session-info">
                      <div className={`session-status ${session.score === 100 ? 'green' : 'purple'}`}></div>
                      <div className="session-details">
                        <span className="session-title">{session.title}</span>
                        <span className="session-date">Score: {session.score}%</span>
                      </div>
                    </div>
                    <div className="session-meta">
                      <span className="session-duration">{Math.round(session.durationSeconds / 60)} mins</span>
                      <span className="session-score">{session.score === 100 ? 'Completed' : 'Review needed'}</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="recent-session-item">
                  <div className="session-info">
                    <div className="session-details">
                      <span className="session-title">No recent sessions</span>
                      <span className="session-date">Complete a drill or daily challenge to see it here!</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

        </div>

        {/* Aside - Sidebar - Progress Stats */}
        <aside className="practice-sidebar">
          
          {/* Practice Streaks */}
          <div className="sidebar-card">
            <div className="sidebar-card-header">
              <div className="streak-icon"></div>
              <h3>{stats?.streakDays || 0} Day Streak</h3>
            </div>
            <div className="streak-metric">
              <span className="streak-number">{stats?.percentile || 0}%</span>
              <span className="streak-label">UPPER</span>
            </div>
            <p className="sidebar-subtext">You're in the top {stats?.percentile || 0}% of mindful learners this month. Keep the momentum.</p>
            <div className="streak-tracker">
              <div className="streak-day active"></div>
              <div className="streak-day active"></div>
              <div className="streak-day active"></div>
              <div className="streak-day active"></div>
              <div className="streak-day inactive"></div>
              <div className="streak-day inactive"></div>
              <div className="streak-day inactive"></div>
            </div>
          </div>

          {/* Skill Breakdown */}
          <div className="sidebar-card">
            <div className="sidebar-card-header">
              <h3>Cognitive Mastery</h3>
            </div>
            <div className="skill-breakdown-list">
              {(stats?.skillBreakdown || []).length > 0 ? (
                stats.skillBreakdown.map((skill: any) => (
                  <div className="skill-row" key={skill.name}>
                    <div className="skill-labels">
                      <span className="skill-name">{skill.name}</span>
                      <span className="skill-score">{skill.score}%</span>
                    </div>
                    <div className="skill-bar-track">
                      <div className="skill-bar-fill" style={{ width: `${skill.score}%` }}></div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="skill-row">
                  <span className="skill-name truncate">Complete modules to unlock Cognitive Mastery</span>
                </div>
              )}
            </div>
            <button className="skill-btn">Detailed Report</button>
          </div>

        </aside>
      </div>

      {showSetup && practiceModules.length > 0 && (
        <PracticeSetupModal
          moduleOptions={practiceModules}
          onBegin={handleBeginSession}
          onClose={() => setShowSetup(false)}
        />
      )}
    </div>
  );
}

