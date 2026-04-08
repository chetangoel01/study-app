export type TrackId =
  | 'dsa-leetcode'
  | 'system-design'
  | 'machine-learning'
  | 'resume-behavioral';

export interface Track { id: TrackId; label: string; }

export interface CurriculumItem {
  id: string;
  type: 'read' | 'do' | 'check';
  label: string;
  url: string | null;
}

export interface CurriculumModule {
  id: string;
  title: string;
  track: TrackId;
  phase: string;
  summary: string;
  estimate: string;
  sessions: number;
  countsTowardSchedule: boolean;
  sourceUrl: string;
  items: CurriculumItem[];
  prerequisiteModuleIds: string[];
}

export interface PlanningTopic {
  id: string;
  planning_topic_id: string;
  label: string;
  module_ids: string[];
  study_guide_markdown?: string;
}

export interface CurriculumIndex {
  tracks: Track[];
  modules: CurriculumModule[];
  moduleById: Map<string, CurriculumModule>;
  modulesByTrack: Map<TrackId, CurriculumModule[]>;
  topicsByModule: Map<string, PlanningTopic[]>;
  allTopics: PlanningTopic[];
}
