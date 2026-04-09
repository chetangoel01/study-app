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
}

export interface ModuleContent {
  moduleId: string;
  items: CurriculumItem[];
  topics: { id: string; label: string; study_guide_markdown: string }[];
}

export interface CurriculumResponse { tracks: Track[]; modules: CurriculumModule[]; }
export interface AuthUser { id: number; email: string; }
