import { readFileSync } from 'fs';
import { config } from '../config.js';
import type {
  CurriculumIndex,
  CurriculumItem,
  CurriculumModule,
  PlanningTopic,
  SynthesizedTopic,
  Track,
  TrackId,
} from './types.js';

interface LoadOptions {
  curriculumPath?: string;
  knowledgeBasePath?: string;
}

interface TrackModulePlan {
  modules: CurriculumModule[];
  topicModuleOverrides: Map<string, string>;
}

const DSA_BUCKET_IDS = new Set([
  'foundations-and-analysis',
  'linear-structures-and-patterns',
  'trees-search-and-ordering',
  'recursive-and-optimization-paradigms',
  'graph-algorithms-and-traversal',
]);

const SYSTEM_BUCKET_IDS = new Set([
  'oop-and-architecture',
  'distributed-systems-and-platforms',
  'system-design-curriculum',
]);

const MODULE_ID_ALIASES: Record<string, string> = {
  'supplemental-behavioral-interviews': 'review-interview',
  'supplemental-career': 'review-interview',
  'supplemental-frontend-interviews': 'review-interview',
  'supplemental-interview-handbooks': 'review-interview',
  'supplemental-system-design-interviews': 'system-design',
  'supplemental-systems-concepts': 'system-design',
  'supplemental-ml-interviews': 'machine-learning-core',
};

function normalizeModuleId(moduleId: string): string {
  const raw = String(moduleId || '').trim();
  if (!raw) return '';
  if (raw.startsWith('leetcode-export-')) {
    return `leetcode-course-${raw.slice('leetcode-export-'.length)}`;
  }
  return MODULE_ID_ALIASES[raw] ?? raw;
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
  const mergedPlanningTopics = mergePlanningTopics(
    kb.planning_topics ?? [],
    kb.topics ?? [],
  );
  const bucketByPlanningTopic = buildBucketByPlanningTopic(kb.topics ?? []);
  const sourceUrlsByPlanningTopic = buildSourceUrlsByPlanningTopic(kb.topics ?? []);
  const bucketModuleIdsByBucket = buildBucketModuleIdsByBucket(kb.curriculum_buckets ?? []);
  const planningTopicEdges = Array.isArray(kb.planning_topic_edges) ? kb.planning_topic_edges : [];

  const trackByPlanningTopic = new Map<string, TrackId>();
  for (const topic of mergedPlanningTopics) {
    trackByPlanningTopic.set(topic.planning_topic_id, inferTrackForTopic(topic, bucketByPlanningTopic));
  }

  const orderedTopicsByTrack = orderTopicsByTrack(
    mergedPlanningTopics,
    trackByPlanningTopic,
    planningTopicEdges,
  );
  const modulePlan = buildTrackModulePlan({
    rawModules: curriculum.modules,
    planningTopics: mergedPlanningTopics,
    orderedTopicsByTrack,
    trackByPlanningTopic,
    sourceUrlsByPlanningTopic,
  });
  const modules = modulePlan.modules;
  const topicModuleOverrides = modulePlan.topicModuleOverrides;

  const moduleById = new Map<string, CurriculumModule>();
  const modulesByTrack = new Map<TrackId, CurriculumModule[]>();
  for (const m of modules) {
    moduleById.set(m.id, m);
    const list = modulesByTrack.get(m.track) ?? [];
    list.push(m);
    modulesByTrack.set(m.track, list);
  }

  const topicsByModule = new Map<string, PlanningTopic[]>();
  const allTopics: PlanningTopic[] = [];
  const trackOrder: TrackId[] = ['dsa-leetcode', 'system-design', 'machine-learning', 'resume-behavioral'];

  for (const trackId of trackOrder) {
    const topicsInTrack = orderedTopicsByTrack.get(trackId) ?? [];
    if (!topicsInTrack.length) continue;
    const trackModules = modulesByTrack.get(trackId) ?? [];
    const moduleOrder = new Map(trackModules.map((module, index) => [module.id, index]));
    const moduleLoad = new Map(trackModules.map((module) => [module.id, 0]));

    for (const [index, topic] of topicsInTrack.entries()) {
      const forcedModuleId = topicModuleOverrides.get(topic.planning_topic_id);
      const primaryModuleId = forcedModuleId ?? pickPrimaryModuleForTopic({
        topic,
        topicIndex: index,
        trackTopicsCount: topicsInTrack.length,
        trackModules,
        moduleOrder,
        moduleLoad,
        bucketByPlanningTopic,
        bucketModuleIdsByBucket,
      });

      const normalizedTopic: PlanningTopic = {
        ...topic,
        module_ids: primaryModuleId ? [primaryModuleId] : [],
      };
      allTopics.push(normalizedTopic);

      if (!primaryModuleId) continue;
      const list = topicsByModule.get(primaryModuleId) ?? [];
      list.push(normalizedTopic);
      topicsByModule.set(primaryModuleId, list);
    }
  }

  return { tracks, modules, moduleById, modulesByTrack, topicsByModule, allTopics };
}

function mergePlanningTopics(
  planningTopics: PlanningTopic[],
  synthesizedTopics: SynthesizedTopic[],
): PlanningTopic[] {
  if (!planningTopics.length) {
    return [];
  }

  const bestSynthesizedByPlanningTopic = new Map<string, SynthesizedTopic>();
  for (const topic of synthesizedTopics) {
    const planningTopicId = String(topic.planning_topic_id ?? '').trim();
    if (!planningTopicId) {
      continue;
    }

    const existing = bestSynthesizedByPlanningTopic.get(planningTopicId);
    const existingLength = String(existing?.study_guide_markdown ?? '').trim().length;
    const nextLength = String(topic.study_guide_markdown ?? '').trim().length;
    if (!existing || nextLength > existingLength) {
      bestSynthesizedByPlanningTopic.set(planningTopicId, topic);
    }
  }

  return planningTopics.map((topic) => {
    if (String(topic.study_guide_markdown ?? '').trim()) {
      return topic;
    }

    const synthesized = bestSynthesizedByPlanningTopic.get(topic.planning_topic_id);
    if (!synthesized) {
      return topic;
    }

    return {
      ...topic,
      study_guide_markdown: synthesized.study_guide_markdown,
    };
  });
}

function buildBucketByPlanningTopic(synthesizedTopics: SynthesizedTopic[]): Map<string, string> {
  const bucketByPlanningTopic = new Map<string, string>();
  for (const topic of synthesizedTopics) {
    const planningTopicId = String(topic.planning_topic_id ?? '').trim();
    const bucketId = String((topic as any).bucket_id ?? '').trim();
    if (!planningTopicId || !bucketId || bucketByPlanningTopic.has(planningTopicId)) {
      continue;
    }
    bucketByPlanningTopic.set(planningTopicId, bucketId);
  }
  return bucketByPlanningTopic;
}

function buildSourceUrlsByPlanningTopic(synthesizedTopics: SynthesizedTopic[]): Map<string, string[]> {
  const sourceUrlsByPlanningTopic = new Map<string, string[]>();
  for (const topic of synthesizedTopics) {
    const planningTopicId = String(topic.planning_topic_id ?? '').trim();
    if (!planningTopicId) continue;
    const rawUrls: unknown[] = Array.isArray((topic as any).source_urls) ? (topic as any).source_urls : [];
    const cleanedUrls: string[] = [...new Set(rawUrls
      .map((value: unknown) => String(value ?? '').trim())
      .filter(Boolean))];
    if (!cleanedUrls.length) continue;
    sourceUrlsByPlanningTopic.set(planningTopicId, cleanedUrls);
  }
  return sourceUrlsByPlanningTopic;
}

function buildBucketModuleIdsByBucket(curriculumBuckets: Array<Record<string, unknown>>): Map<string, string[]> {
  const bucketModuleIdsByBucket = new Map<string, string[]>();
  for (const bucket of curriculumBuckets) {
    const bucketId = String(bucket.bucket_id ?? '').trim();
    if (!bucketId) continue;
    const moduleIdsRaw = Array.isArray(bucket.module_ids) ? bucket.module_ids : [];
    const moduleIds = [...new Set(moduleIdsRaw
      .map((value) => normalizeModuleId(String(value)))
      .filter(Boolean))];
    bucketModuleIdsByBucket.set(bucketId, moduleIds);
  }
  return bucketModuleIdsByBucket;
}

function inferTrackForTopic(
  topic: PlanningTopic,
  bucketByPlanningTopic: Map<string, string>,
): TrackId {
  const planningTopicId = String(topic.planning_topic_id ?? '').trim();
  if (planningTopicId === 'machine-learning-interview-preparation') {
    return 'machine-learning';
  }

  const bucketId = bucketByPlanningTopic.get(planningTopicId) ?? '';
  if (DSA_BUCKET_IDS.has(bucketId)) return 'dsa-leetcode';
  if (SYSTEM_BUCKET_IDS.has(bucketId)) return 'system-design';
  if (bucketId === 'interview-preparation-and-career') return 'resume-behavioral';

  const category = String((topic as any).category ?? '').trim().toLowerCase();
  if (category === 'systems') return 'system-design';
  if (category === 'interview' || category === 'career') return 'resume-behavioral';
  return 'dsa-leetcode';
}

interface BuildTrackModulePlanArgs {
  rawModules: CurriculumModule[];
  planningTopics: PlanningTopic[];
  orderedTopicsByTrack: Map<TrackId, PlanningTopic[]>;
  trackByPlanningTopic: Map<string, TrackId>;
  sourceUrlsByPlanningTopic: Map<string, string[]>;
}

function buildTrackModulePlan(args: BuildTrackModulePlanArgs): TrackModulePlan {
  const {
    rawModules,
    planningTopics,
    orderedTopicsByTrack,
    trackByPlanningTopic,
    sourceUrlsByPlanningTopic,
  } = args;

  let modules = ensureAutogeneratedTrackModules(rawModules, planningTopics, trackByPlanningTopic);
  const topicModuleOverrides = new Map<string, string>();

  const systemTopics = orderedTopicsByTrack.get('system-design') ?? [];
  const systemModuleCount = modules.filter((module) => module.track === 'system-design').length;
  if (systemTopics.length >= 6 && systemModuleCount <= 1) {
    const segmentation = buildSystemDesignSegmentation(systemTopics, sourceUrlsByPlanningTopic);
    modules = replaceTrackModules(modules, 'system-design', segmentation.modules);
    for (const [topicId, moduleId] of segmentation.topicModuleOverrides.entries()) {
      topicModuleOverrides.set(topicId, moduleId);
    }
  }

  const resumeTopics = orderedTopicsByTrack.get('resume-behavioral') ?? [];
  const resumeModuleCount = modules.filter((module) => module.track === 'resume-behavioral').length;
  if (resumeTopics.length >= 3 && resumeModuleCount <= 1) {
    const segmentation = buildResumeSegmentation(resumeTopics, sourceUrlsByPlanningTopic);
    modules = replaceTrackModules(modules, 'resume-behavioral', segmentation.modules);
    for (const [topicId, moduleId] of segmentation.topicModuleOverrides.entries()) {
      topicModuleOverrides.set(topicId, moduleId);
    }
  }

  return { modules, topicModuleOverrides };
}

function replaceTrackModules(
  modules: CurriculumModule[],
  trackId: TrackId,
  replacementModules: CurriculumModule[],
): CurriculumModule[] {
  const firstTrackIndex = modules.findIndex((module) => module.track === trackId);
  const withoutTrackModules = modules.filter((module) => module.track !== trackId);
  const insertionIndex = firstTrackIndex >= 0 ? Math.min(firstTrackIndex, withoutTrackModules.length) : withoutTrackModules.length;
  withoutTrackModules.splice(insertionIndex, 0, ...replacementModules);
  return withoutTrackModules;
}

function buildSystemDesignSegmentation(
  topics: PlanningTopic[],
  sourceUrlsByPlanningTopic: Map<string, string[]>,
): TrackModulePlan {
  const blueprints = [
    {
      id: 'system-design',
      title: 'System Design Foundations',
      phase: 'Foundations',
      summary: 'Learn to clarify scope, model users and traffic, and sketch high-level APIs before diving into infrastructure.',
      fallbackSourceUrl: 'https://github.com/donnemartin/system-design-primer',
      actionLabel: 'Run a 20-minute design kickoff where you only clarify requirements, assumptions, and constraints.',
      optionalLabel: 'Optional exercise: redo the same prompt with stricter latency and cost constraints.',
    },
    {
      id: 'system-design-architecture-patterns',
      title: 'Architecture Patterns and APIs',
      phase: 'Architecture',
      summary: 'Move from OOP and architecture primitives to service boundaries, contracts, and end-to-end request flow.',
      fallbackSourceUrl: 'https://www.techinterviewhandbook.org/system-design',
      actionLabel: 'Draw a component diagram with clear interfaces, ownership, and critical request paths.',
      optionalLabel: 'Optional exercise: compare two architecture styles and justify which one you would ship first.',
    },
    {
      id: 'system-design-data-and-storage',
      title: 'Data, Caching, and Storage',
      phase: 'Data Layer',
      summary: 'Build instincts around data models, querying patterns, partitioning, cache strategy, and consistency tradeoffs.',
      fallbackSourceUrl: 'https://github.com/donnemartin/system-design-primer',
      actionLabel: 'Design a schema, cache plan, and query path for one high-traffic endpoint.',
      optionalLabel: 'Optional exercise: propose a migration plan from single-node SQL to sharded storage.',
    },
    {
      id: 'system-design-distributed-systems',
      title: 'Distributed Systems and Networking',
      phase: 'Distributed Systems',
      summary: 'Connect networking, CAP tradeoffs, load balancing, and cloud primitives into a coherent scaling strategy.',
      fallbackSourceUrl: 'https://www.hiredintech.com/system-design/',
      actionLabel: 'Whiteboard how traffic enters, balances, and fans out across distributed services.',
      optionalLabel: 'Optional exercise: describe failure domains and fallback behavior for each network hop.',
    },
    {
      id: 'system-design-reliability-and-operations',
      title: 'Reliability, Concurrency, and Operations',
      phase: 'Operations',
      summary: 'Focus on race conditions, deployment safety, observability, and operational readiness for production systems.',
      fallbackSourceUrl: 'https://www.techinterviewhandbook.org/system-design',
      actionLabel: 'Create an operations checklist with monitoring, alerting, and rollback criteria.',
      optionalLabel: 'Optional exercise: run a mock incident review and identify one concrete hardening improvement.',
    },
    {
      id: 'system-design-interview-practice',
      title: 'System Design Interview Drills',
      phase: 'Interview Readiness',
      summary: 'Tie everything together into timed interview drills that emphasize communication, tradeoffs, and iteration.',
      fallbackSourceUrl: 'https://www.techinterviewhandbook.org/system-design',
      actionLabel: 'Complete a timed mock and deliver a concise tradeoff summary at the end.',
      optionalLabel: 'Optional exercise: replay the same mock and optimize only one subsystem under a new constraint.',
    },
  ] as const;

  const assignments = new Map<string, PlanningTopic[]>();
  const topicModuleOverrides = new Map<string, string>();
  for (const [index, topic] of topics.entries()) {
    const moduleId = pickSystemModuleId(topic.planning_topic_id, index, topics.length);
    const list = assignments.get(moduleId) ?? [];
    list.push(topic);
    assignments.set(moduleId, list);
    topicModuleOverrides.set(topic.planning_topic_id, moduleId);
  }

  const activeBlueprints = blueprints.filter((blueprint) => (assignments.get(blueprint.id)?.length ?? 0) > 0);
  const modules = activeBlueprints.map((blueprint, index) => {
    const moduleTopics = assignments.get(blueprint.id) ?? [];
    const resourceUrl = pickBestSourceUrl(moduleTopics, sourceUrlsByPlanningTopic, blueprint.fallbackSourceUrl);
    const sessions = Math.max(1, Math.ceil(moduleTopics.length / 2));
    return {
      id: blueprint.id,
      title: blueprint.title,
      track: 'system-design' as const,
      phase: blueprint.phase,
      summary: blueprint.summary,
      estimate: `${sessions} sessions`,
      sessions,
      countsTowardSchedule: false,
      sourceUrl: resourceUrl,
      prerequisiteModuleIds: index === 0 ? [] : [activeBlueprints[index - 1].id],
      items: buildSectionResourceActionItems({
        moduleId: blueprint.id,
        sectionLabel: blueprint.title,
        resourceUrl,
        actionLabel: blueprint.actionLabel,
        optionalLabel: blueprint.optionalLabel,
      }),
    } satisfies CurriculumModule;
  });

  return { modules, topicModuleOverrides };
}

function buildResumeSegmentation(
  topics: PlanningTopic[],
  sourceUrlsByPlanningTopic: Map<string, string[]>,
): TrackModulePlan {
  const flowPriority = new Map<string, number>([
    ['resume-writing', 0],
    ['behavioral-interview-preparation', 1],
    ['technical-interview-preparation', 2],
    ['coding-interview-preparation', 3],
    ['coding-patterns', 4],
    ['whiteboard-coding', 5],
    ['front-end-interview-preparation', 6],
    ['open-source-contribution', 7],
    ['competitive-programming', 8],
    ['salary-negotiation', 9],
  ]);
  const sourceIndexByTopicId = new Map(topics.map((topic, index) => [topic.planning_topic_id, index]));
  const orderedTopics = [...topics].sort((left, right) => {
    const leftPriority = flowPriority.get(left.planning_topic_id) ?? Number.MAX_SAFE_INTEGER;
    const rightPriority = flowPriority.get(right.planning_topic_id) ?? Number.MAX_SAFE_INTEGER;
    if (leftPriority !== rightPriority) return leftPriority - rightPriority;
    const leftSourceIndex = sourceIndexByTopicId.get(left.planning_topic_id) ?? Number.MAX_SAFE_INTEGER;
    const rightSourceIndex = sourceIndexByTopicId.get(right.planning_topic_id) ?? Number.MAX_SAFE_INTEGER;
    return leftSourceIndex - rightSourceIndex;
  });

  const topicModuleOverrides = new Map<string, string>();
  const modules = orderedTopics.map((topic, index) => {
    const moduleId = index === 0 ? 'review-interview' : `resume-${topic.planning_topic_id}`;
    topicModuleOverrides.set(topic.planning_topic_id, moduleId);
    const previousModuleId = index === 1
      ? 'review-interview'
      : (index > 1 ? `resume-${orderedTopics[index - 1].planning_topic_id}` : '');
    const resourceUrl = pickBestSourceUrl(
      [topic],
      sourceUrlsByPlanningTopic,
      'https://www.techinterviewhandbook.org/resume',
    );
    return {
      id: moduleId,
      title: topic.label,
      track: 'resume-behavioral' as const,
      phase: `Resume and Behavioral ${index + 1}`,
      summary: `Convert ${topic.label.toLowerCase()} into concrete interview evidence with one section, one reference, and one action.`,
      estimate: '1 session',
      sessions: 1,
      countsTowardSchedule: false,
      sourceUrl: resourceUrl,
      prerequisiteModuleIds: index === 0 ? [] : [previousModuleId],
      items: buildSectionResourceActionItems({
        moduleId,
        sectionLabel: topic.label,
        resourceUrl,
        actionLabel: resumeActionLabelForTopic(topic),
      }),
    } satisfies CurriculumModule;
  });

  return { modules, topicModuleOverrides };
}

function pickSystemModuleId(planningTopicId: string, topicIndex: number, totalTopics: number): string {
  const foundations = new Set([
    'system-design',
    'system-design-clarification',
    'system-design-fundamentals',
  ]);
  const architecture = new Set([
    'object-oriented-programming',
    'object-oriented-design',
    'software-architecture',
    'api-design',
    'front-end-system-design',
    'microservices-architecture',
  ]);
  const dataLayer = new Set([
    'database-systems',
    'sql-joins',
    'caching-strategies',
    'consistent-hashing',
    'database-sharding',
  ]);
  const distributed = new Set([
    'distributed-systems',
    'load-balancing',
    'cap-theorem',
    'cloud-computing',
    'computer-networking',
    'internet-protocol',
    'ip-addressing-and-subnetting',
    'operating-systems',
  ]);
  const reliability = new Set([
    'concurrency',
    'devops-and-deployment',
    'site-reliability-engineering',
  ]);
  const practice = new Set([
    'system-design-interview-preparation',
  ]);

  if (foundations.has(planningTopicId)) return 'system-design';
  if (architecture.has(planningTopicId)) return 'system-design-architecture-patterns';
  if (dataLayer.has(planningTopicId)) return 'system-design-data-and-storage';
  if (distributed.has(planningTopicId)) return 'system-design-distributed-systems';
  if (reliability.has(planningTopicId)) return 'system-design-reliability-and-operations';
  if (practice.has(planningTopicId)) return 'system-design-interview-practice';

  const fallbackOrder = [
    'system-design',
    'system-design-architecture-patterns',
    'system-design-data-and-storage',
    'system-design-distributed-systems',
    'system-design-reliability-and-operations',
  ];
  const fallbackIndex = Math.min(
    fallbackOrder.length - 1,
    Math.floor((topicIndex * fallbackOrder.length) / Math.max(1, totalTopics)),
  );
  return fallbackOrder[fallbackIndex];
}

function buildSectionResourceActionItems(args: {
  moduleId: string;
  sectionLabel: string;
  resourceUrl: string | null;
  actionLabel: string;
  optionalLabel?: string;
}): CurriculumItem[] {
  const {
    moduleId,
    sectionLabel,
    resourceUrl,
    actionLabel,
    optionalLabel,
  } = args;

  const items: CurriculumItem[] = [
    {
      id: `${moduleId}:read:section`,
      type: 'read',
      label: `Section: ${sectionLabel}`,
      url: null,
    },
    {
      id: `${moduleId}:read:resource`,
      type: 'read',
      label: `Resource: ${resourceLabelForUrl(resourceUrl)}`,
      url: resourceUrl,
    },
    {
      id: `${moduleId}:do:action`,
      type: 'do',
      label: `Action: ${actionLabel}`,
      url: null,
    },
  ];
  if (optionalLabel) {
    items.push({
      id: `${moduleId}:check:optional`,
      type: 'check',
      label: optionalLabel,
      url: null,
    });
  }
  return items;
}

function pickBestSourceUrl(
  topics: PlanningTopic[],
  sourceUrlsByPlanningTopic: Map<string, string[]>,
  fallbackUrl: string,
): string {
  for (const topic of topics) {
    const urls = sourceUrlsByPlanningTopic.get(topic.planning_topic_id) ?? [];
    const preferred = pickPreferredUrl(urls);
    if (preferred) return preferred;
  }
  return fallbackUrl;
}

function pickPreferredUrl(urls: string[]): string | null {
  if (!urls.length) return null;

  const filtered = urls.filter((url) => {
    const lower = url.toLowerCase();
    return !lower.includes('wikipedia.org')
      && !lower.includes('/followers')
      && !lower.includes('/following')
      && !lower.includes('/archive')
      && !lower.includes('archive.org');
  });
  const candidates = filtered.length ? filtered : urls;

  const priorities = [
    'techinterviewhandbook.org',
    'hiredintech.com',
    'system-design-primer',
    'github.com/donnemartin',
    'github.com/jwasham',
    'github.com/yangshun',
    'github.com/ashishps1',
    'pramp.com',
    'interviewing.io',
    'kalzumeus.com',
    'freecodecamp.org',
  ];
  for (const needle of priorities) {
    const match = candidates.find((url) => url.toLowerCase().includes(needle));
    if (match) return match;
  }
  return candidates[0] ?? null;
}

function resourceLabelForUrl(url: string | null): string {
  if (!url) return 'Curated reference';
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return 'Curated reference';
  }
}

function resumeActionLabelForTopic(topic: PlanningTopic): string {
  const id = topic.planning_topic_id;
  if (id === 'resume-writing') {
    return 'Rewrite one resume section using quantified outcomes and verify each bullet with evidence.';
  }
  if (id === 'behavioral-interview-preparation') {
    return 'Prepare two STAR stories for leadership, conflict, and failure, then rehearse them out loud.';
  }
  if (id === 'salary-negotiation') {
    return 'Write your compensation range, walk-away number, and a short negotiation script before interviews.';
  }
  if (id === 'technical-interview-preparation' || id === 'coding-interview-preparation') {
    return 'Schedule two mock interviews this week and capture debrief notes after each round.';
  }
  if (id === 'whiteboard-coding') {
    return 'Run one whiteboard session and narrate trade-offs while keeping the solution structure clear.';
  }
  if (id === 'open-source-contribution') {
    return 'Document one contribution with problem, action, and measurable impact for your story bank.';
  }
  if (id === 'front-end-interview-preparation') {
    return 'Prepare one UI case study where you explain architecture choices and UX trade-offs.';
  }
  if (id === 'coding-patterns' || id === 'competitive-programming') {
    return 'Create a pattern review sheet and practice explaining when each pattern does or does not apply.';
  }
  return `Complete one concrete artifact for ${topic.label.toLowerCase()} and add it to your interview prep notebook.`;
}

function ensureAutogeneratedTrackModules(
  rawModules: CurriculumModule[],
  planningTopics: PlanningTopic[],
  trackByPlanningTopic: Map<string, TrackId>,
): CurriculumModule[] {
  const modules = [...rawModules];
  const tracksWithModules = new Set(modules.map((module) => module.track));

  const topicCountByTrack = new Map<TrackId, number>();
  for (const topic of planningTopics) {
    const trackId = trackByPlanningTopic.get(topic.planning_topic_id);
    if (!trackId) continue;
    topicCountByTrack.set(trackId, (topicCountByTrack.get(trackId) ?? 0) + 1);
  }

  for (const [trackId, topicCount] of topicCountByTrack.entries()) {
    if (topicCount <= 0 || tracksWithModules.has(trackId)) {
      continue;
    }
    const module = autogeneratedModuleForTrack(trackId);
    if (!module) continue;
    modules.push(module);
    tracksWithModules.add(trackId);
  }

  return modules;
}

function autogeneratedModuleForTrack(trackId: TrackId): CurriculumModule | null {
  if (trackId === 'machine-learning') {
    return {
      id: 'machine-learning-core',
      title: 'Machine Learning Interview Foundations',
      track: 'machine-learning',
      phase: 'Core Track',
      summary: 'Linearized machine-learning interview topics sourced from curated ML interview references.',
      estimate: '6 sessions',
      sessions: 6,
      countsTowardSchedule: false,
      sourceUrl: 'https://github.com/khangich/machine-learning-interview',
      prerequisiteModuleIds: [],
      items: [],
    };
  }
  if (trackId === 'resume-behavioral') {
    return {
      id: 'resume-behavioral-core',
      title: 'Resume and Behavioral Foundations',
      track: 'resume-behavioral',
      phase: 'Core Track',
      summary: 'Linearized interview communication and career-readiness topics from the knowledge graph.',
      estimate: '5 sessions',
      sessions: 5,
      countsTowardSchedule: false,
      sourceUrl: 'https://github.com/jwasham/coding-interview-university',
      prerequisiteModuleIds: [],
      items: [],
    };
  }
  if (trackId === 'system-design') {
    return {
      id: 'system-design-core',
      title: 'System Design Foundations',
      track: 'system-design',
      phase: 'Core Track',
      summary: 'Linearized system-design and distributed-systems topics from the knowledge graph.',
      estimate: '8 sessions',
      sessions: 8,
      countsTowardSchedule: false,
      sourceUrl: 'https://github.com/donnemartin/system-design-primer',
      prerequisiteModuleIds: [],
      items: [],
    };
  }
  return null;
}

function orderTopicsByTrack(
  planningTopics: PlanningTopic[],
  trackByPlanningTopic: Map<string, TrackId>,
  planningTopicEdges: Array<Record<string, unknown>>,
): Map<TrackId, PlanningTopic[]> {
  const grouped = new Map<TrackId, PlanningTopic[]>();
  for (const topic of planningTopics) {
    const trackId = trackByPlanningTopic.get(topic.planning_topic_id);
    if (!trackId) continue;
    const list = grouped.get(trackId) ?? [];
    list.push(topic);
    grouped.set(trackId, list);
  }

  const ordered = new Map<TrackId, PlanningTopic[]>();
  for (const [trackId, topics] of grouped.entries()) {
    ordered.set(trackId, stableTopologicalOrder(topics, planningTopicEdges));
  }
  return ordered;
}

function normalizePlanningTopicId(value: unknown): string {
  const raw = String(value ?? '').trim();
  return raw.startsWith('planning:') ? raw.slice('planning:'.length) : raw;
}

function stableTopologicalOrder(
  topics: PlanningTopic[],
  planningTopicEdges: Array<Record<string, unknown>>,
): PlanningTopic[] {
  const topicById = new Map(topics.map((topic) => [topic.planning_topic_id, topic]));
  const orderById = new Map(topics.map((topic, index) => [topic.planning_topic_id, index]));
  const outgoing = new Map<string, Set<string>>();
  const indegree = new Map<string, number>();

  for (const topic of topics) {
    outgoing.set(topic.planning_topic_id, new Set());
    indegree.set(topic.planning_topic_id, 0);
  }

  for (const edge of planningTopicEdges) {
    const type = String(edge.type ?? '');
    if (type && type !== 'prerequisite') continue;
    const fromId = normalizePlanningTopicId(edge.from);
    const toId = normalizePlanningTopicId(edge.to);
    if (!topicById.has(fromId) || !topicById.has(toId) || fromId === toId) {
      continue;
    }
    const neighbors = outgoing.get(fromId);
    if (!neighbors || neighbors.has(toId)) continue;
    neighbors.add(toId);
    indegree.set(toId, (indegree.get(toId) ?? 0) + 1);
  }

  const queue = [...topics]
    .map((topic) => topic.planning_topic_id)
    .filter((topicId) => (indegree.get(topicId) ?? 0) === 0)
    .sort((a, b) => (orderById.get(a) ?? 0) - (orderById.get(b) ?? 0));

  const orderedIds: string[] = [];
  while (queue.length) {
    const topicId = queue.shift() as string;
    orderedIds.push(topicId);

    for (const nextId of outgoing.get(topicId) ?? []) {
      const nextDegree = (indegree.get(nextId) ?? 0) - 1;
      indegree.set(nextId, nextDegree);
      if (nextDegree === 0) {
        queue.push(nextId);
      }
    }
    queue.sort((a, b) => (orderById.get(a) ?? 0) - (orderById.get(b) ?? 0));
  }

  if (orderedIds.length !== topics.length) {
    const seen = new Set(orderedIds);
    const missing = topics
      .map((topic) => topic.planning_topic_id)
      .filter((topicId) => !seen.has(topicId))
      .sort((a, b) => (orderById.get(a) ?? 0) - (orderById.get(b) ?? 0));
    orderedIds.push(...missing);
  }

  return orderedIds.map((topicId) => topicById.get(topicId) as PlanningTopic);
}

interface PickPrimaryModuleArgs {
  topic: PlanningTopic;
  topicIndex: number;
  trackTopicsCount: number;
  trackModules: CurriculumModule[];
  moduleOrder: Map<string, number>;
  moduleLoad: Map<string, number>;
  bucketByPlanningTopic: Map<string, string>;
  bucketModuleIdsByBucket: Map<string, string[]>;
}

function pickPrimaryModuleForTopic(args: PickPrimaryModuleArgs): string {
  const {
    topic,
    topicIndex,
    trackTopicsCount,
    trackModules,
    moduleOrder,
    moduleLoad,
    bucketByPlanningTopic,
    bucketModuleIdsByBucket,
  } = args;

  if (!trackModules.length) {
    return '';
  }

  const targetModuleIndex = Math.min(
    trackModules.length - 1,
    Math.floor((topicIndex * trackModules.length) / Math.max(1, trackTopicsCount)),
  );
  const trackModuleIds = new Set(trackModules.map((module) => module.id));

  const directCandidates = [...new Set((topic.module_ids ?? [])
    .map((moduleId) => normalizeModuleId(moduleId))
    .filter((moduleId) => trackModuleIds.has(moduleId)))];
  const bucketId = bucketByPlanningTopic.get(topic.planning_topic_id) ?? '';
  const bucketCandidates = [...new Set((bucketModuleIdsByBucket.get(bucketId) ?? [])
    .filter((moduleId) => trackModuleIds.has(moduleId)))];
  const candidates = directCandidates.length
    ? directCandidates
    : (bucketCandidates.length ? bucketCandidates : trackModules.map((module) => module.id));

  const sorted = [...candidates].sort((left, right) => {
    const leftLoad = moduleLoad.get(left) ?? 0;
    const rightLoad = moduleLoad.get(right) ?? 0;
    if (leftLoad !== rightLoad) return leftLoad - rightLoad;

    const leftOrder = moduleOrder.get(left) ?? Number.MAX_SAFE_INTEGER;
    const rightOrder = moduleOrder.get(right) ?? Number.MAX_SAFE_INTEGER;
    const leftDistance = Math.abs(leftOrder - targetModuleIndex);
    const rightDistance = Math.abs(rightOrder - targetModuleIndex);
    if (leftDistance !== rightDistance) return leftDistance - rightDistance;
    return leftOrder - rightOrder;
  });

  const chosen = sorted[0] ?? trackModules[targetModuleIndex]?.id ?? trackModules[0].id;
  moduleLoad.set(chosen, (moduleLoad.get(chosen) ?? 0) + 1);
  return chosen;
}
