import { describe, it, expect } from 'vitest';
import { writeFileSync, mkdirSync } from 'fs';
import { resolve } from 'path';
import { tmpdir } from 'os';
import { loadCurriculum } from './loader.js';

const dir = resolve(tmpdir(), 'study-loader-test');
mkdirSync(dir, { recursive: true });

const CURRICULUM = {
  version: 1,
  generated_at: '2026-01-01T00:00:00Z',
  tracks: [{ id: 'dsa-leetcode', label: 'DSA & LeetCode' }],
  modules: [
    {
      id: 'big-o', title: 'Big-O', track: 'dsa-leetcode', phase: 'Core Track',
      summary: 'Complexity', estimate: '2 sessions', sessions: 2,
      countsTowardSchedule: true, sourceUrl: 'https://x.com',
      items: [{ id: 'big-o:read:0', type: 'read', label: 'Read X', url: 'https://x.com' }],
      prerequisiteModuleIds: [],
    },
    {
      id: 'arrays', title: 'Arrays', track: 'dsa-leetcode', phase: 'Core Track',
      summary: 'Array ops', estimate: '4 sessions', sessions: 4,
      countsTowardSchedule: true, sourceUrl: 'https://x.com',
      items: [], prerequisiteModuleIds: ['big-o'],
    },
    {
      id: 'trees-heaps', title: 'Trees & Heaps', track: 'dsa-leetcode', phase: 'Core Track',
      summary: 'Tree patterns', estimate: '4 sessions', sessions: 4,
      countsTowardSchedule: true, sourceUrl: 'https://x.com',
      items: [], prerequisiteModuleIds: ['arrays'],
    },
    {
      id: 'leetcode-course-heaps', title: 'LeetCode Crash Course: Heaps', track: 'dsa-leetcode', phase: 'LeetCode Course',
      summary: 'Heaps chapter', estimate: '2 sessions', sessions: 2,
      countsTowardSchedule: false, sourceUrl: 'https://leetcode.com',
      items: [], prerequisiteModuleIds: [],
    },
  ],
};

const KB = {
  version: '3',
  topics: [{
    id: 'topic:big-o',
    planning_topic_id: 'complexity',
    label: 'Big-O Notation',
    module_ids: ['big-o'],
    study_guide_markdown: '## Big-O\nO(n) means linear time.',
  }, {
    id: 'topic:heaps',
    planning_topic_id: 'heaps',
    label: 'Heaps',
    module_ids: ['leetcode-course-heaps'],
    study_guide_markdown: '## Heaps\nPriority queue basics.',
  }],
  planning_topics: [{
    id: 'planning:complexity', planning_topic_id: 'complexity',
    label: 'Big-O Notation', module_ids: ['big-o'],
    study_guide_markdown: '',
  }, {
    id: 'planning:heaps', planning_topic_id: 'heaps',
    label: 'Heaps', module_ids: ['leetcode-course-heaps'],
    study_guide_markdown: '',
  }],
};

const curriculumPath = resolve(dir, 'curriculum.json');
const kbPath = resolve(dir, 'kb.json');
writeFileSync(curriculumPath, JSON.stringify(CURRICULUM));
writeFileSync(kbPath, JSON.stringify(KB));

describe('loadCurriculum', () => {
  it('builds index with correct module count', () => {
    const idx = loadCurriculum({ curriculumPath, knowledgeBasePath: kbPath });
    expect(idx.modules).toHaveLength(4);
  });

  it('indexes modules by id', () => {
    const idx = loadCurriculum({ curriculumPath, knowledgeBasePath: kbPath });
    expect(idx.moduleById.get('big-o')?.title).toBe('Big-O');
  });

  it('groups modules by track', () => {
    const idx = loadCurriculum({ curriculumPath, knowledgeBasePath: kbPath });
    expect(idx.modulesByTrack.get('dsa-leetcode')).toHaveLength(4);
  });

  it('maps planning topics to modules', () => {
    const idx = loadCurriculum({ curriculumPath, knowledgeBasePath: kbPath });
    const topics = idx.topicsByModule.get('big-o') ?? [];
    expect(topics[0].label).toBe('Big-O Notation');
    expect(topics[0].study_guide_markdown).toContain('O(n)');
  });

  it('assigns each topic to one linear primary module with no fanout duplication', () => {
    const idx = loadCurriculum({ curriculumPath, knowledgeBasePath: kbPath });
    const chapterTopics = idx.topicsByModule.get('leetcode-course-heaps') ?? [];
    const legacyTopics = idx.topicsByModule.get('trees-heaps') ?? [];
    expect(chapterTopics.length + legacyTopics.length).toBe(1);
    const assignedTopic = chapterTopics[0] ?? legacyTopics[0];
    expect(assignedTopic.planning_topic_id).toBe('heaps');
    expect(assignedTopic.study_guide_markdown).toContain('Priority queue basics');
  });

  it('segments system-design and resume tracks into linear module flows', () => {
    const segCurriculumPath = resolve(dir, 'curriculum-seg.json');
    const segKbPath = resolve(dir, 'kb-seg.json');

    writeFileSync(segCurriculumPath, JSON.stringify({
      version: 1,
      generated_at: '2026-01-01T00:00:00Z',
      tracks: [
        { id: 'system-design', label: 'System Design' },
        { id: 'resume-behavioral', label: 'Resume & Behavioral' },
        { id: 'machine-learning', label: 'Machine Learning' },
      ],
      modules: [
        {
          id: 'system-design',
          title: 'Optional: system design and scalability',
          track: 'system-design',
          phase: 'Optional Advanced',
          summary: 'Legacy single system module',
          estimate: '8 sessions',
          sessions: 8,
          countsTowardSchedule: false,
          sourceUrl: 'https://github.com/jwasham/coding-interview-university',
          items: [],
          prerequisiteModuleIds: [],
        },
        {
          id: 'review-interview',
          title: 'Final review and interview loop',
          track: 'resume-behavioral',
          phase: 'Interview Loop',
          summary: 'Legacy single resume module',
          estimate: '5 sessions',
          sessions: 5,
          countsTowardSchedule: false,
          sourceUrl: 'https://github.com/jwasham/coding-interview-university',
          items: [],
          prerequisiteModuleIds: [],
        },
      ],
    }));

    writeFileSync(segKbPath, JSON.stringify({
      version: '3',
      planning_topics: [
        { id: 'planning:system-design', planning_topic_id: 'system-design', label: 'System Design', module_ids: [], study_guide_markdown: '' },
        { id: 'planning:object-oriented-design', planning_topic_id: 'object-oriented-design', label: 'Object-Oriented Design', module_ids: [], study_guide_markdown: '' },
        { id: 'planning:database-systems', planning_topic_id: 'database-systems', label: 'Database Systems', module_ids: [], study_guide_markdown: '' },
        { id: 'planning:distributed-systems', planning_topic_id: 'distributed-systems', label: 'Distributed Systems', module_ids: [], study_guide_markdown: '' },
        { id: 'planning:concurrency', planning_topic_id: 'concurrency', label: 'Concurrency', module_ids: [], study_guide_markdown: '' },
        { id: 'planning:system-design-interview-preparation', planning_topic_id: 'system-design-interview-preparation', label: 'System Design Interview Preparation', module_ids: [], study_guide_markdown: '' },
        { id: 'planning:resume-writing', planning_topic_id: 'resume-writing', label: 'Resume Writing', module_ids: [], study_guide_markdown: '' },
        { id: 'planning:behavioral-interview-preparation', planning_topic_id: 'behavioral-interview-preparation', label: 'Behavioral Interview Preparation', module_ids: [], study_guide_markdown: '' },
        { id: 'planning:salary-negotiation', planning_topic_id: 'salary-negotiation', label: 'Salary Negotiation', module_ids: [], study_guide_markdown: '' },
      ],
      topics: [
        {
          id: 'topic:system-design',
          planning_topic_id: 'system-design',
          label: 'System Design',
          bucket_id: 'system-design-curriculum',
          module_ids: ['system-design'],
          source_urls: ['https://www.techinterviewhandbook.org/system-design'],
          study_guide_markdown: '# System Design',
        },
        {
          id: 'topic:object-oriented-design',
          planning_topic_id: 'object-oriented-design',
          label: 'Object-Oriented Design',
          bucket_id: 'oop-and-architecture',
          module_ids: ['system-design'],
          source_urls: ['https://github.com/donnemartin/system-design-primer'],
          study_guide_markdown: '# OOD',
        },
        {
          id: 'topic:database-systems',
          planning_topic_id: 'database-systems',
          label: 'Database Systems',
          bucket_id: 'distributed-systems-and-platforms',
          module_ids: ['system-design'],
          source_urls: ['https://www.hiredintech.com/system-design/'],
          study_guide_markdown: '# Databases',
        },
        {
          id: 'topic:distributed-systems',
          planning_topic_id: 'distributed-systems',
          label: 'Distributed Systems',
          bucket_id: 'distributed-systems-and-platforms',
          module_ids: ['system-design'],
          source_urls: ['https://www.techinterviewhandbook.org/system-design'],
          study_guide_markdown: '# Distributed',
        },
        {
          id: 'topic:concurrency',
          planning_topic_id: 'concurrency',
          label: 'Concurrency',
          bucket_id: 'distributed-systems-and-platforms',
          module_ids: ['system-design'],
          source_urls: ['https://www.techinterviewhandbook.org/system-design'],
          study_guide_markdown: '# Concurrency',
        },
        {
          id: 'topic:system-design-interview-preparation',
          planning_topic_id: 'system-design-interview-preparation',
          label: 'System Design Interview Preparation',
          bucket_id: 'system-design-curriculum',
          module_ids: ['system-design'],
          source_urls: ['https://www.techinterviewhandbook.org/system-design'],
          study_guide_markdown: '# Mocking',
        },
        {
          id: 'topic:resume-writing',
          planning_topic_id: 'resume-writing',
          label: 'Resume Writing',
          bucket_id: 'interview-preparation-and-career',
          module_ids: ['review-interview'],
          source_urls: ['https://www.techinterviewhandbook.org/resume'],
          study_guide_markdown: '# Resume',
        },
        {
          id: 'topic:behavioral-interview-preparation',
          planning_topic_id: 'behavioral-interview-preparation',
          label: 'Behavioral Interview Preparation',
          bucket_id: 'interview-preparation-and-career',
          module_ids: ['review-interview'],
          source_urls: ['https://www.techinterviewhandbook.org/behavioral-interview'],
          study_guide_markdown: '# Behavioral',
        },
        {
          id: 'topic:salary-negotiation',
          planning_topic_id: 'salary-negotiation',
          label: 'Salary Negotiation',
          bucket_id: 'interview-preparation-and-career',
          module_ids: ['review-interview'],
          source_urls: ['https://www.kalzumeus.com/2012/01/23/salary-negotiation'],
          study_guide_markdown: '# Salary',
        },
      ],
      planning_topic_edges: [
        { from: 'planning:system-design', to: 'planning:object-oriented-design', type: 'prerequisite' },
        { from: 'planning:object-oriented-design', to: 'planning:database-systems', type: 'prerequisite' },
        { from: 'planning:database-systems', to: 'planning:distributed-systems', type: 'prerequisite' },
        { from: 'planning:distributed-systems', to: 'planning:concurrency', type: 'prerequisite' },
        { from: 'planning:concurrency', to: 'planning:system-design-interview-preparation', type: 'prerequisite' },
        { from: 'planning:resume-writing', to: 'planning:behavioral-interview-preparation', type: 'prerequisite' },
        { from: 'planning:behavioral-interview-preparation', to: 'planning:salary-negotiation', type: 'prerequisite' },
      ],
      curriculum_buckets: [],
    }));

    const idx = loadCurriculum({ curriculumPath: segCurriculumPath, knowledgeBasePath: segKbPath });
    const systemModules = idx.modules.filter((module) => module.track === 'system-design');
    const resumeModules = idx.modules.filter((module) => module.track === 'resume-behavioral');

    expect(systemModules.length).toBeGreaterThan(1);
    expect(systemModules[0]?.id).toBe('system-design');
    expect(systemModules.every((module) => module.items.some((item) => item.label.startsWith('Action:')))).toBe(true);
    expect(systemModules[1]?.prerequisiteModuleIds).toEqual([systemModules[0]?.id]);

    expect(resumeModules).toHaveLength(3);
    expect(resumeModules[0]?.id).toBe('review-interview');
    expect(resumeModules.every((module) => module.items.some((item) => item.label.startsWith('Section:')))).toBe(true);
    expect(resumeModules.every((module) => module.items.some((item) => item.label.startsWith('Resource:')))).toBe(true);
    expect(resumeModules.every((module) => module.items.some((item) => item.label.startsWith('Action:')))).toBe(true);

    const reviewTopics = idx.topicsByModule.get('review-interview') ?? [];
    expect(reviewTopics[0]?.planning_topic_id).toBe('resume-writing');
  });

  it('throws on curriculum version mismatch', () => {
    const bad = resolve(dir, 'bad.json');
    writeFileSync(bad, JSON.stringify({ ...CURRICULUM, version: 99 }));
    expect(() =>
      loadCurriculum({ curriculumPath: bad, knowledgeBasePath: kbPath })
    ).toThrow(/curriculum.json version mismatch/);
  });
});
