import { readFileSync } from 'fs';
import { config } from '../config.js';
import type { CurriculumIndex, CurriculumModule, PlanningTopic, Track, TrackId } from './types.js';

interface LoadOptions {
  curriculumPath?: string;
  knowledgeBasePath?: string;
}

export function loadCurriculum(opts: LoadOptions = {}): CurriculumIndex {
  const curriculumPath = opts.curriculumPath ?? config.curriculumPath;
  const knowledgeBasePath = opts.knowledgeBasePath ?? config.knowledgeBasePath;

  let curriculum: any;
  try {
    curriculum = JSON.parse(readFileSync(curriculumPath, 'utf-8'));
  } catch (e: any) {
    throw new Error(
      `Failed to load curriculum.json at ${curriculumPath}: ${e.message}. ` +
      `Run 'python3 build_study_data.py' and restart.`
    );
  }
  if (curriculum.version !== config.CURRICULUM_JSON_VERSION) {
    throw new Error(
      `curriculum.json version mismatch: expected ${config.CURRICULUM_JSON_VERSION}, ` +
      `got ${curriculum.version}. Run python3 build_study_data.py and restart.`
    );
  }

  let kb: any;
  try {
    kb = JSON.parse(readFileSync(knowledgeBasePath, 'utf-8'));
  } catch (e: any) {
    throw new Error(
      `Failed to load knowledge-base.json at ${knowledgeBasePath}: ${e.message}. ` +
      `Run 'python3 pipeline/runner.py' and restart.`
    );
  }
  if (String(kb.version) !== String(config.KNOWLEDGE_BASE_VERSION)) {
    throw new Error(
      `knowledge-base.json version mismatch: expected ${config.KNOWLEDGE_BASE_VERSION}, ` +
      `got ${kb.version}. Run python3 pipeline/runner.py and restart.`
    );
  }

  const tracks: Track[] = curriculum.tracks;
  const modules: CurriculumModule[] = curriculum.modules;

  const moduleById = new Map<string, CurriculumModule>();
  const modulesByTrack = new Map<TrackId, CurriculumModule[]>();

  for (const m of modules) {
    moduleById.set(m.id, m);
    const list = modulesByTrack.get(m.track) ?? [];
    list.push(m);
    modulesByTrack.set(m.track, list);
  }

  const planningTopics: PlanningTopic[] = kb.planning_topics ?? [];
  const topicsByModule = new Map<string, PlanningTopic[]>();
  for (const topic of planningTopics) {
    for (const moduleId of topic.module_ids ?? []) {
      const list = topicsByModule.get(moduleId) ?? [];
      list.push(topic);
      topicsByModule.set(moduleId, list);
    }
  }

  return { tracks, modules, moduleById, modulesByTrack, topicsByModule, allTopics: planningTopics };
}
