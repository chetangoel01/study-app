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
export interface AuthUser {
  id: number;
  email: string;
  timezone: string;
  defaultRolePreference?: RolePreference;
}

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

export type RolePreference = 'interviewee' | 'interviewer' | 'either';

export type InviteStatus = 'pending_acceptance' | 'accepted' | 'declined' | 'cancelled';

export interface InviteCounterparty {
  id: string;
  fullName: string;
  initials: string;
}

export interface InviteSummary {
  id: string;
  direction: 'sent' | 'received';
  counterparty: InviteCounterparty;
  status: InviteStatus;
  scheduledFor: string;
  durationMinutes: number;
  topic: string;
  rolePreference: RolePreference;
  sourceBlockId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface InviteEvent {
  id: string;
  actorId: string;
  eventType: 'created' | 'accepted' | 'declined' | 'cancelled' | 'rescheduled';
  payload: Record<string, unknown> | null;
  createdAt: string;
}

export interface InviteDetail extends InviteSummary {
  events: InviteEvent[];
}

export interface AvailabilityBlockSummary {
  blockId: string;
  proposalId: string;
  startsAt: string;
  status: 'open' | 'claimed' | 'cancelled';
  claimedBy: { id: string; fullName: string } | null;
  mockInterviewId: string | null;
}

export interface MyAvailabilityProposal {
  id: string;
  durationMinutes: number;
  topic: string;
  notes: string;
  rolePreference: RolePreference;
  createdAt: string;
  blocks: AvailabilityBlockSummary[];
}

export interface MyAvailability {
  proposals: MyAvailabilityProposal[];
}

export interface FeedBlock {
  blockId: string;
  proposalId: string;
  postedBy: { id: string; fullName: string; initials: string };
  startsAt: string;
  durationMinutes: number;
  topic: string;
  notes: string;
  rolePreference: RolePreference;
}

export interface MockPeer {
  id: string;
  fullName: string;
  initials: string;
  defaultRolePreference: RolePreference;
}

export interface ScheduleResponse {
  invites: InviteSummary[];
}

export const COMMUNITY_TAGS = [
  'system-design', 'dsa', 'career', 'behavioral', 'devops',
] as const;
export type CommunityTag = (typeof COMMUNITY_TAGS)[number];

export const COMMUNITY_TAG_LABELS: Record<CommunityTag, string> = {
  'system-design': 'System design',
  'dsa': 'DSA',
  'career': 'Career',
  'behavioral': 'Behavioral',
  'devops': 'DevOps',
};

export interface CommunityAuthor {
  id: number;
  name: string;
  avatarUrl: string | null;
}

export interface CommunityThread {
  id: string;
  title: string;
  tag: CommunityTag;
  author: CommunityAuthor | null;
  createdAt: string;
  lastActivityAt: string;
  editedAt: string | null;
  deletedAt: string | null;
  replyCount: number;
  viewCount: number;
  isSubscribed: boolean;
  excerpt: string;
}

export interface CommunityThreadFull extends CommunityThread {
  body_md: string;
}

export interface CommunityReply {
  id: string;
  author: CommunityAuthor | null;
  body_md: string;
  createdAt: string;
  editedAt: string | null;
  deletedAt: string | null;
  canEdit: boolean;
}

export type CommunityFilter = 'all' | 'subscribed' | 'trending';
