export type TrackId = 'dsa-leetcode' | 'system-design' | 'machine-learning' | 'resume-behavioral';
export type ModuleStatus = 'done' | 'in-progress' | 'available';
export type ItemType = 'read' | 'do' | 'check';

export interface Track { id: TrackId; label: string; }

export interface CurriculumItem {
  id: string; type: ItemType; label: string; url: string | null;
}

export interface CurriculumModule {
  id: string; title: string; track: TrackId; phase: string;
  summary: string; estimate: string; sessions: number;
  countsTowardSchedule: boolean; sourceUrl: string;
  prerequisiteModuleIds: string[];
  items: CurriculumItem[];                    // all items (no markdown); enables next-unchecked lookup
  totalItems: number; completedItems: number; status: ModuleStatus;
  blockedBy: string[];                        // IDs of unmet prerequisites shown as guidance only
  latest_progress_updated_at: string | null;  // ISO timestamp of most recent progress row
  guideStepsCompleted: number;
  guideStepsTotal: number;
  maxGuideStep: number;
}

export interface ModuleContent {
  moduleId: string;
  items: CurriculumItem[];
  topics: { id: string; label: string; study_guide_markdown: string }[];
}

export interface CurriculumResponse { tracks: Track[]; modules: CurriculumModule[]; }
export interface AuthUser { id: number; email: string; }

export interface ChallengeTestCase {
  args: unknown[];
  expected: unknown;
}

export interface ChallengeTestResult {
  passed: boolean;
  output: string;
  expected: string;
}

export interface DailyChallenge {
  id: number;
  title: string;
  difficulty: string | null;
  leetcodeUrl: string | null;
  descriptionMarkdown: string;
  starterCode: string;
  functionName?: string;
  testCases?: ChallengeTestCase[];
  tags?: string[];
  durationMins: number;
  completed: boolean;
  completedAt: string | null;
}

export interface ChallengeRunResponse {
  results: ChallengeTestResult[];
  allPassed: boolean;
}

export interface PracticeSessionSummary {
  id: number;
  type: string;
  title: string;
  durationSeconds: number;
  score: number;
  createdAt: string;
}

export interface SkillBreakdownItem {
  name: string;
  score: number;
}

export interface PracticeTagSignal {
  tag: string;
  count: number;
}

export interface QuizAccuracyTrendPoint {
  date: string;
  attempts: number;
  accuracy: number;
}

export interface QuizDifficultyStat {
  difficulty: 'Easy' | 'Medium' | 'Hard';
  questions: number;
  accuracy: number;
}

export interface QuizModeStat {
  mode: string;
  label: string;
  attempts: number;
  questions: number;
  accuracy: number;
}

export interface QuizWeakTopic {
  tag: string;
  attempts: number;
  misses: number;
  accuracy: number;
}

export interface PracticeQuizAnalytics {
  totalAttempts: number;
  totalQuestions: number;
  overallAccuracy: number;
  accuracyTrend: QuizAccuracyTrendPoint[];
  byDifficulty: QuizDifficultyStat[];
  byMode: QuizModeStat[];
  weakTopics: QuizWeakTopic[];
}

export interface PracticeStats {
  streakDays: number;
  percentile: number;
  streakWeek: boolean[];
  recentSessions: PracticeSessionSummary[];
  skillBreakdown: SkillBreakdownItem[];
  tagSignals?: PracticeTagSignal[];
  quizAnalytics?: PracticeQuizAnalytics;
}

export interface MockPeer {
  id: string;
  fullName: string;
  initials: string;
}
