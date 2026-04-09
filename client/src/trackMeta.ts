import type { TrackId } from './types.js';

export const TRACK_BLURBS: Record<TrackId, string> = {
  'dsa-leetcode': 'Pattern drills, timed reps, and cleaner problem solving under pressure.',
  'system-design': 'Architecture practice with sharper tradeoffs, diagrams, and communication.',
  'machine-learning': 'Model intuition, ML systems thinking, and practical interview fluency.',
  'resume-behavioral': 'Tighter stories, stronger examples, and calmer experience walkthroughs.',
};

/** Track overview: what this subject area is (full-width lead under the title). */
export const TRACK_TOPIC_PRIMARY: Record<TrackId, string> = {
  'dsa-leetcode':
    'This track is about data structures and algorithms as they show up in real interviews—not memorized tricks, but fluent pattern recognition, tight complexity arguments, and code you can defend under follow-up questions. You work from foundations (asymptotics, core structures) through classical problem families so that when a prompt is thrown at you, you can narrow the search space, pick a sensible approach, and implement it without freezing.',
  'system-design':
    'This track treats system design as a communication and judgment exercise: clarifying requirements, sketching components, naming tradeoffs, and knowing when to stop. You move from single-machine intuition to distributed concerns—storage, consistency, scaling, failure—and practice turning a vague product idea into a coherent architecture you can draw and explain in under an hour.',
  'machine-learning':
    'This track connects statistical learning, model behavior, and the systems that ship ML in production. You strengthen intuition for how models learn and generalize, how to evaluate them honestly, and how training, serving, and data pipelines fit together so you can speak credibly about both the math-adjacent core and the engineering reality.',
  'resume-behavioral':
    'This track is about presenting your experience as evidence: concrete situations, what you did, what changed, and what you learned. You refine stories for leadership, conflict, mistakes, and scope so interviews feel like a structured conversation instead of a vague “tell me about yourself” scramble.',
};

/** Second paragraph on the track overview—more depth on the same topic, still full width. */
export const TRACK_TOPIC_ELABORATION: Record<TrackId, string> = {
  'dsa-leetcode':
    'Modules follow a practical order: each one mixes guided study with checkpoints so you rehearse reading a problem, choosing a strategy, and coding under mild time pressure. Revisit finished modules anytime; the goal is durable intuition, not a single pass through a checklist.',
  'system-design':
    'Expect to revisit APIs, databases, caches, queues, and observability from different angles, with emphasis on back-of-envelope reasoning and explicit non-goals. The point is not one “correct” diagram but a repeatable way to structure ambiguity and defend your choices.',
  'machine-learning':
    'You will cycle through supervised learning staples, evaluation and debugging, and the systems concerns—data drift, latency, retraining, and responsible deployment—that interviewers increasingly expect alongside textbook concepts.',
  'resume-behavioral':
    'You will align your resume bullets with narrative arcs interviewers can probe, practice concise framing, and build a small library of examples you can adapt so behavioral rounds feel prepared rather than improvised.',
};
