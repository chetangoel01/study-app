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
  ],
};

const KB = {
  version: '3',
  planning_topics: [{
    id: 'planning:complexity', planning_topic_id: 'complexity',
    label: 'Big-O Notation', module_ids: ['big-o'],
    study_guide_markdown: '',
  }],
  topics: [{
    id: 'topic:big-o',
    planning_topic_id: 'complexity',
    label: 'Big-O Notation',
    module_ids: ['big-o'],
    study_guide_markdown: '## Big-O\nO(n) means linear time.',
  }],
};

const curriculumPath = resolve(dir, 'curriculum.json');
const kbPath = resolve(dir, 'kb.json');
writeFileSync(curriculumPath, JSON.stringify(CURRICULUM));
writeFileSync(kbPath, JSON.stringify(KB));

describe('loadCurriculum', () => {
  it('builds index with correct module count', () => {
    const idx = loadCurriculum({ curriculumPath, knowledgeBasePath: kbPath });
    expect(idx.modules).toHaveLength(2);
  });

  it('indexes modules by id', () => {
    const idx = loadCurriculum({ curriculumPath, knowledgeBasePath: kbPath });
    expect(idx.moduleById.get('big-o')?.title).toBe('Big-O');
  });

  it('groups modules by track', () => {
    const idx = loadCurriculum({ curriculumPath, knowledgeBasePath: kbPath });
    expect(idx.modulesByTrack.get('dsa-leetcode')).toHaveLength(2);
  });

  it('maps planning topics to modules', () => {
    const idx = loadCurriculum({ curriculumPath, knowledgeBasePath: kbPath });
    const topics = idx.topicsByModule.get('big-o') ?? [];
    expect(topics[0].label).toBe('Big-O Notation');
    expect(topics[0].study_guide_markdown).toContain('O(n)');
  });

  it('throws on curriculum version mismatch', () => {
    const bad = resolve(dir, 'bad.json');
    writeFileSync(bad, JSON.stringify({ ...CURRICULUM, version: 99 }));
    expect(() =>
      loadCurriculum({ curriculumPath: bad, knowledgeBasePath: kbPath })
    ).toThrow(/curriculum.json version mismatch/);
  });
});
