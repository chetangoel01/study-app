import type { CurriculumModule, PracticeTagSignal, SkillBreakdownItem } from '../types.js';

export type MasterySectionKey = 'algorithms' | 'system-design' | 'concurrency';

export interface MasteryModuleProgress {
  id: string;
  title: string;
  score: number;
  done: number;
  total: number;
}

export interface MasterySection {
  key: MasterySectionKey;
  name: string;
  score: number;
  done: number;
  total: number;
  modules: MasteryModuleProgress[];
}

export interface MasteryPatternSignal {
  id: string;
  label: string;
  areaKey: MasterySectionKey;
  areaName: string;
  score: number;
  evidenceCount: number;
  practiceCount: number;
}

const SECTION_ORDER: Array<{ key: MasterySectionKey; name: string }> = [
  { key: 'algorithms', name: 'Algorithms' },
  { key: 'system-design', name: 'System Design' },
  { key: 'concurrency', name: 'Concurrency' },
];

function getModuleProgress(module: CurriculumModule) {
  const total = Math.max(0, (module.totalItems ?? 0) + (module.guideStepsTotal ?? 0));
  const doneRaw = (module.completedItems ?? 0) + (module.guideStepsCompleted ?? 0);
  const done = Math.min(total, Math.max(0, doneRaw));
  const score = total > 0 ? Math.round((done / total) * 100) : 0;
  return { done, total, score };
}

function isSystemDesignModule(module: CurriculumModule): boolean {
  const moduleText = `${module.id} ${module.title}`.toLowerCase();
  return module.track === 'system-design' || moduleText.includes('system design');
}

function isConcurrencyModule(module: CurriculumModule): boolean {
  const moduleText = `${module.id} ${module.title}`.toLowerCase();
  if (module.id === 'systems-basics') return true;
  return /(concurrency|concurrent|parallel|thread|lock|race condition)/.test(moduleText);
}

function classifyMasterySection(module: CurriculumModule): MasterySectionKey | null {
  if (isSystemDesignModule(module)) return 'system-design';
  if (isConcurrencyModule(module)) return 'concurrency';
  if (module.track === 'dsa-leetcode') return 'algorithms';

  const moduleText = `${module.id} ${module.title}`.toLowerCase();
  if (/(algorithm|array|graph|tree|heap|sort|search|hash|leetcode|dynamic programming|\bdp\b)/.test(moduleText)) {
    return 'algorithms';
  }

  return null;
}

function getModulePriority(module: MasteryModuleProgress): number {
  if (module.total === 0) return 5;
  if (module.score === 0) return 1;
  if (module.score >= 100) return 4;
  return 0;
}

export function buildMasterySections(modules: CurriculumModule[]): MasterySection[] {
  const grouped = new Map<MasterySectionKey, MasteryModuleProgress[]>(
    SECTION_ORDER.map(({ key }) => [key, []]),
  );

  for (const module of modules) {
    const sectionKey = classifyMasterySection(module);
    if (!sectionKey) continue;
    const progress = getModuleProgress(module);
    grouped.get(sectionKey)?.push({
      id: module.id,
      title: module.title,
      score: progress.score,
      done: progress.done,
      total: progress.total,
    });
  }

  return SECTION_ORDER.map(({ key, name }) => {
    const sectionModules = [...(grouped.get(key) ?? [])].sort((a, b) => {
      const priorityDelta = getModulePriority(a) - getModulePriority(b);
      if (priorityDelta !== 0) return priorityDelta;
      if (a.score !== b.score) return a.score - b.score;
      return b.total - a.total;
    });

    const totals = sectionModules.reduce(
      (acc, module) => ({
        done: acc.done + module.done,
        total: acc.total + module.total,
      }),
      { done: 0, total: 0 },
    );

    return {
      key,
      name,
      score: totals.total > 0 ? Math.round((totals.done / totals.total) * 100) : 0,
      done: totals.done,
      total: totals.total,
      modules: sectionModules,
    };
  });
}

export function sectionsToSkillBreakdown(sections: MasterySection[]): SkillBreakdownItem[] {
  return sections.map((section) => ({ name: section.name, score: section.score }));
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function clampPercent(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)));
}

export function buildMasteryPatternSignals(sections: MasterySection[]): MasteryPatternSignal[] {
  const sectionByKey = new Map<MasterySectionKey, MasterySection>(
    sections.map((section) => [section.key, section]),
  );
  const moduleScoreById = new Map<string, number>();
  const allModules = sections.flatMap((section) => section.modules);
  for (const module of allModules) {
    moduleScoreById.set(module.id, module.score);
  }

  const patterns: Array<{
    id: string;
    label: string;
    areaKey: MasterySectionKey;
    moduleIds: string[];
  }> = [
    {
      id: 'arrays-and-strings',
      label: 'Arrays',
      areaKey: 'algorithms',
      moduleIds: ['arrays-linked-lists', 'leetcode-course-arraystrings'],
    },
    {
      id: 'two-pointers',
      label: 'Two Ptrs',
      areaKey: 'algorithms',
      moduleIds: ['leetcode-course-arraystrings', 'arrays-linked-lists', 'leetcode-course-linked-lists'],
    },
    {
      id: 'hashing',
      label: 'Hashing',
      areaKey: 'algorithms',
      moduleIds: ['stacks-queues-hashes', 'leetcode-course-hashing'],
    },
    {
      id: 'binary-search',
      label: 'Binary Search',
      areaKey: 'algorithms',
      moduleIds: ['search-bitwise', 'leetcode-course-binary-search'],
    },
    {
      id: 'graph-traversal',
      label: 'Graphs',
      areaKey: 'algorithms',
      moduleIds: ['graphs', 'leetcode-course-traversals-trees-graphs', 'trees-heaps'],
    },
    {
      id: 'dynamic-programming',
      label: 'DP',
      areaKey: 'algorithms',
      moduleIds: ['recursion-dp', 'leetcode-course-dynamic-programming', 'leetcode-course-backtracking'],
    },
    {
      id: 'scalability-tradeoffs',
      label: 'Scalability',
      areaKey: 'system-design',
      moduleIds: ['system-design'],
    },
    {
      id: 'caching',
      label: 'Caching',
      areaKey: 'system-design',
      moduleIds: ['system-design', 'systems-basics'],
    },
    {
      id: 'thread-safety',
      label: 'Thread Safety',
      areaKey: 'concurrency',
      moduleIds: ['systems-basics'],
    },
  ];

  return patterns.map((pattern) => {
    const matchedScores = pattern.moduleIds
      .map((moduleId) => moduleScoreById.get(moduleId))
      .filter((score): score is number => typeof score === 'number');
    const area = sectionByKey.get(pattern.areaKey);
    const score = matchedScores.length > 0 ? mean(matchedScores) : (area?.score ?? 0);
    return {
      id: pattern.id,
      label: pattern.label,
      areaKey: pattern.areaKey,
      areaName: area?.name ?? pattern.areaKey,
      score: clampPercent(score),
      evidenceCount: matchedScores.length,
      practiceCount: 0,
    };
  });
}

const PATTERN_TAG_ALIASES: Record<string, string[]> = {
  'arrays-and-strings': ['array', 'arrays', 'string', 'strings', 'arraystrings'],
  'two-pointers': ['two pointers', 'two-pointer', 'two_pointers', 'linked list', 'two sum'],
  hashing: ['hash', 'hashing', 'hashmap', 'map'],
  'binary-search': ['binary search', 'search'],
  'graph-traversal': ['graph', 'graphs', 'tree', 'bfs', 'dfs', 'traversal'],
  'dynamic-programming': ['dynamic programming', 'dp', 'memoization', 'tabulation', 'backtracking'],
  'scalability-tradeoffs': ['system design', 'scalability', 'caching', 'distributed systems'],
  caching: ['cache', 'caching', 'lru', 'lfu', 'redis'],
  'thread-safety': ['concurrency', 'thread', 'threads', 'lock', 'locks', 'race condition'],
};

function matchesAlias(tag: string, alias: string): boolean {
  return tag === alias || tag.includes(alias) || alias.includes(tag);
}

export function mergePatternPracticeSignals(
  patterns: MasteryPatternSignal[],
  tagSignals: PracticeTagSignal[] | undefined,
): MasteryPatternSignal[] {
  if (!tagSignals || tagSignals.length === 0) return patterns;
  const tagCounts = new Map<string, number>();
  for (const tagSignal of tagSignals) {
    const normalized = tagSignal.tag.trim().toLowerCase();
    if (!normalized) continue;
    tagCounts.set(normalized, (tagCounts.get(normalized) ?? 0) + Math.max(0, tagSignal.count));
  }

  return patterns.map((pattern) => {
    const aliases = PATTERN_TAG_ALIASES[pattern.id] ?? [];
    let practiceCount = 0;
    for (const [tag, count] of tagCounts.entries()) {
      if (aliases.some((alias) => matchesAlias(tag, alias))) {
        practiceCount += count;
      }
    }
    if (practiceCount <= 0) {
      return pattern;
    }

    // Blend curriculum progress with tagged practice volume so repeated pattern work moves the signal upward.
    const exposureScore = Math.min(100, practiceCount * 12);
    const blended = clampPercent(Math.round((pattern.score * 0.85) + (exposureScore * 0.15)));
    return {
      ...pattern,
      score: blended,
      practiceCount,
    };
  });
}
