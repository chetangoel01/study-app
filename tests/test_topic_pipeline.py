import os
import sys
import unittest
import json
from pathlib import Path
from unittest.mock import patch


ROOT = Path(__file__).resolve().parents[1]
PIPELINE_DIR = ROOT / "pipeline"

for path in (ROOT, PIPELINE_DIR):
    if str(path) not in sys.path:
        sys.path.insert(0, str(path))

os.environ.setdefault("OPENROUTER_API_KEY", "test-openrouter-key")


import chunker
import bucket_builder
import bucket_synthesizer
import edge_builder
import topic_lesson_synthesizer
import topic_validator


class ChunkerTests(unittest.TestCase):
    def test_markdown_document_splits_by_heading(self):
        document = {
            "document_id": "doc:1",
            "module_id": "core",
            "resource_url": "https://example.com/resource",
            "source_url": "https://example.com/source",
            "title": "Two Pointer Guide",
            "heading_path": ["Two Pointer Guide"],
            "text": "# Two Pointers\nIntro text\n\n## Variants\nVariant text",
        }

        chunks = chunker.chunk_document(document)

        self.assertEqual(len(chunks), 2)
        self.assertEqual(chunks[0]["heading_path"], ["Two Pointers"])
        self.assertEqual(chunks[1]["heading_path"], ["Two Pointers", "Variants"])


class BucketBuilderTests(unittest.TestCase):
    def test_build_curriculum_buckets_assigns_chunks_by_topic_and_module_fallback(self):
        ontology = {
            "topics": [
                {
                    "id": "recursion",
                    "label": "Recursion",
                    "aliases": ["Recursion Basics"],
                    "prerequisites": [],
                },
                {
                    "id": "divide-and-conquer",
                    "label": "Divide and Conquer",
                    "aliases": ["Divide and Conquer Algorithms"],
                    "prerequisites": ["recursion"],
                },
            ]
        }
        bucket_defs = [
            {
                "id": "recursive-paradigms",
                "label": "Recursive Paradigms",
                "summary": "Recursive decomposition and optimization strategies.",
                "topic_ids": ["recursion", "divide-and-conquer"],
                "module_ids": ["recursion-module"],
            }
        ]
        chunks = [
            {
                "chunk_id": "chunk:recursion",
                "module_id": "recursion-module",
                "source_url": "https://example.com/recursion",
                "title": "Recursion Basics",
                "heading_path": ["Recursion Basics"],
                "text": "Recursion solves a problem by calling the same function on a smaller input.",
            },
            {
                "chunk_id": "chunk:divide",
                "module_id": "search-module",
                "source_url": "https://example.com/divide",
                "title": "Algorithm Notes",
                "heading_path": ["Algorithm Notes"],
                "text": "Divide and Conquer algorithms split work into smaller subproblems and combine results.",
            },
            {
                "chunk_id": "chunk:fallback",
                "module_id": "recursion-module",
                "source_url": "https://example.com/fallback",
                "title": "General Practice Notes",
                "heading_path": ["General Practice Notes"],
                "text": "General practice notes without a direct ontology phrase.",
            },
            {
                "chunk_id": "chunk:other",
                "module_id": "other-module",
                "source_url": "https://example.com/other",
                "title": "Miscellaneous Notes",
                "heading_path": ["Miscellaneous Notes"],
                "text": "Unrelated material with no curriculum match.",
            },
        ]

        buckets, diagnostics = bucket_builder.build_curriculum_buckets(
            chunks,
            ontology=ontology,
            bucket_defs=bucket_defs,
        )

        self.assertEqual(len(buckets), 1)
        bucket = buckets[0]
        self.assertEqual(
            bucket["topic_matches"]["recursion"][0]["chunk"]["chunk_id"],
            "chunk:recursion",
        )
        self.assertEqual(
            bucket["topic_matches"]["divide-and-conquer"][0]["chunk"]["chunk_id"],
            "chunk:divide",
        )
        self.assertEqual(
            [chunk["chunk_id"] for chunk in bucket["general_chunks"]],
            ["chunk:fallback"],
        )
        self.assertEqual(diagnostics["assigned_chunks"], 3)
        self.assertEqual(diagnostics["unassigned_chunks"], 1)


class EdgeBuilderTests(unittest.TestCase):
    def test_build_topic_edges_resolves_connections_and_prerequisites(self):
        topics = [
            {
                "id": "topic:two-pointer",
                "label": "Two Pointer",
                "aliases": ["Two Pointers"],
                "connections": [{"label": "Three Pointers", "relation": "extends", "rationale": "Adds a third pointer."}],
                "prerequisites": [],
                "related_topics": [],
            },
            {
                "id": "topic:three-pointers",
                "label": "Three Pointers",
                "aliases": [],
                "connections": [],
                "prerequisites": ["Two Pointers"],
                "related_topics": ["Sliding Window"],
            },
            {
                "id": "topic:sliding-window",
                "label": "Sliding Window",
                "aliases": [],
                "connections": [],
                "prerequisites": [],
                "related_topics": [],
            },
        ]

        edges = edge_builder.build_topic_edges(topics)
        edge_types = {(edge["from"], edge["to"], edge["type"]) for edge in edges}

        self.assertIn(("topic:two-pointer", "topic:three-pointers", "extends"), edge_types)
        self.assertIn(("topic:two-pointer", "topic:three-pointers", "prerequisite"), edge_types)
        self.assertIn(("topic:sliding-window", "topic:three-pointers", "related"), edge_types)

    def test_build_topic_edges_reports_missing_refs_without_using_connection_prerequisites(self):
        topics = [
            {
                "id": "topic:a",
                "label": "A",
                "aliases": [],
                "connections": [],
                "prerequisites": ["B", "Missing Topic"],
                "related_topics": [],
            },
            {
                "id": "topic:b",
                "label": "B",
                "aliases": [],
                "connections": [],
                "prerequisites": ["C"],
                "related_topics": [],
            },
            {
                "id": "topic:c",
                "label": "C",
                "aliases": [],
                "connections": [{"label": "A", "relation": "prerequisite", "rationale": "Closes the loop."}],
                "prerequisites": [],
                "related_topics": [],
            },
        ]

        edges, diagnostics = edge_builder.build_topic_edges(topics, include_diagnostics=True)
        prerequisite_edges = {
            (edge["from"], edge["to"], edge["type"])
            for edge in edges
            if edge["type"] == "prerequisite"
        }

        self.assertEqual(
            prerequisite_edges,
            {
                ("topic:b", "topic:a", "prerequisite"),
                ("topic:c", "topic:b", "prerequisite"),
            },
        )
        self.assertEqual(diagnostics["missing_reference_count"], 1)
        self.assertEqual(diagnostics["missing_references"][0]["label"], "Missing Topic")
        self.assertEqual(diagnostics["dropped_prerequisite_cycle_count"], 0)

    def test_build_topic_edges_ignores_connection_prerequisites(self):
        topics = [
            {
                "id": "topic:binary-search",
                "label": "Binary Search",
                "aliases": [],
                "connections": [],
                "prerequisites": [],
                "related_topics": [],
            },
            {
                "id": "topic:binary-search-tree",
                "label": "Binary Search Tree",
                "aliases": [],
                "connections": [
                    {
                        "label": "Binary Search",
                        "relation": "prerequisite",
                        "rationale": "Requires ordered search reasoning.",
                    }
                ],
                "prerequisites": [],
                "related_topics": [],
            },
        ]

        edges = edge_builder.build_topic_edges(topics)
        edge_types = {(edge["from"], edge["to"], edge["type"]) for edge in edges}

        self.assertNotIn(
            ("topic:binary-search", "topic:binary-search-tree", "prerequisite"),
            edge_types,
        )

    def test_build_topic_edges_prefers_exact_label_over_alias_collision(self):
        topics = [
            {
                "id": "topic:system-design",
                "label": "System Design",
                "aliases": [],
                "connections": [],
                "prerequisites": [],
                "related_topics": [],
            },
            {
                "id": "topic:system-design-fundamentals",
                "label": "System Design Fundamentals",
                "aliases": ["System Design"],
                "connections": [],
                "prerequisites": [],
                "related_topics": [],
            },
            {
                "id": "topic:interview-prep",
                "label": "Interview Preparation",
                "aliases": [],
                "connections": [],
                "prerequisites": ["System Design"],
                "related_topics": [],
            },
        ]

        edges, diagnostics = edge_builder.build_topic_edges(topics, include_diagnostics=True)
        edge_types = {(edge["from"], edge["to"], edge["type"]) for edge in edges}

        self.assertIn(
            ("topic:system-design", "topic:interview-prep", "prerequisite"),
            edge_types,
        )
        self.assertEqual(diagnostics["ambiguous_reference_count"], 0)

    def test_build_topic_edges_reconciles_safe_plural_variants(self):
        topics = [
            {
                "id": "topic:linked-list",
                "label": "Linked List",
                "aliases": [],
                "connections": [],
                "prerequisites": [],
                "related_topics": [],
            },
            {
                "id": "topic:merge-sort-for-linked-lists",
                "label": "Merge Sort for Linked Lists",
                "aliases": [],
                "connections": [],
                "prerequisites": ["Linked Lists"],
                "related_topics": [],
            },
        ]

        edges = edge_builder.build_topic_edges(topics)
        edge_types = {(edge["from"], edge["to"], edge["type"]) for edge in edges}

        self.assertIn(
            ("topic:linked-list", "topic:merge-sort-for-linked-lists", "prerequisite"),
            edge_types,
        )


class TopicValidatorTests(unittest.TestCase):
    def test_canonicalize_topics_merges_duplicates_and_rewrites_alias_refs(self):
        topics = [
            {
                "id": "topic:system-design-fundamentals",
                "slug": "system-design-fundamentals",
                "label": "System Design Fundamentals",
                "aliases": ["System Design Basics"],
                "study_guide_markdown": "Short guide",
                "concepts": ["Scalability"],
                "prerequisites": ["Networking Basics"],
                "related_topics": ["System Design Interview Preparation"],
                "connections": [{"label": "Distributed Systems", "relation": "extends", "rationale": ""}],
                "evidence_chunk_ids": ["chunk:1"],
                "source_urls": ["https://example.com/1"],
                "module_ids": ["system-design"],
                "confidence": 0.6,
            },
            {
                "id": "topic:system-design-fundamentals",
                "slug": "system-design-fundamentals",
                "label": "System Design Fundamentals",
                "aliases": ["Intro to System Design"],
                "study_guide_markdown": "Longer guide with more detail",
                "concepts": ["Load Balancing"],
                "prerequisites": ["Networking Fundamentals"],
                "related_topics": ["System Design Basics"],
                "connections": [{"label": "Distributed Systems", "relation": "extends", "rationale": "Applies the core ideas at cluster scale."}],
                "evidence_chunk_ids": ["chunk:2"],
                "source_urls": ["https://example.com/2"],
                "module_ids": ["interviews"],
                "confidence": 0.9,
            },
            {
                "id": "topic:networking-fundamentals",
                "slug": "networking-fundamentals",
                "label": "Networking Fundamentals",
                "aliases": ["Networking Basics"],
                "study_guide_markdown": "Networking guide",
                "concepts": [],
                "prerequisites": [],
                "related_topics": [],
                "connections": [],
                "evidence_chunk_ids": ["chunk:3"],
                "source_urls": ["https://example.com/3"],
                "module_ids": ["systems"],
                "confidence": 0.7,
            },
            {
                "id": "topic:distributed-systems",
                "slug": "distributed-systems",
                "label": "Distributed Systems",
                "aliases": [],
                "study_guide_markdown": "Distributed systems guide",
                "concepts": [],
                "prerequisites": [],
                "related_topics": [],
                "connections": [],
                "evidence_chunk_ids": ["chunk:4"],
                "source_urls": ["https://example.com/4"],
                "module_ids": ["systems"],
                "confidence": 0.8,
            },
            {
                "id": "topic:system-design-interview-preparation",
                "slug": "system-design-interview-preparation",
                "label": "System Design Interview Preparation",
                "aliases": [],
                "study_guide_markdown": "Interview prep guide",
                "concepts": [],
                "prerequisites": [],
                "related_topics": [],
                "connections": [],
                "evidence_chunk_ids": ["chunk:5"],
                "source_urls": ["https://example.com/5"],
                "module_ids": ["interviews"],
                "confidence": 0.75,
            },
        ]

        canonical_topics, diagnostics = topic_validator.canonicalize_topics(topics)

        self.assertEqual(len(canonical_topics), 4)
        self.assertEqual(diagnostics["merged_topic_count"], 1)
        system_design_topic = next(
            topic
            for topic in canonical_topics
            if topic["label"] == "System Design Fundamentals"
        )
        self.assertEqual(system_design_topic["prerequisites"], ["Networking Fundamentals"])
        self.assertEqual(
            system_design_topic["related_topics"],
            ["System Design Interview Preparation"],
        )
        self.assertEqual(
            system_design_topic["connections"],
            [
                {
                    "label": "Distributed Systems",
                    "relation": "extends",
                    "rationale": "Applies the core ideas at cluster scale.",
                }
            ],
        )
        self.assertCountEqual(
            system_design_topic["aliases"],
            ["System Design Basics", "Intro to System Design"],
        )

    def test_canonicalize_topics_prunes_aliases_that_conflict_with_other_topics(self):
        topics = [
            {
                "id": "topic:system-design",
                "slug": "system-design",
                "label": "System Design",
                "aliases": [],
                "study_guide_markdown": "System design guide",
                "concepts": [],
                "prerequisites": [],
                "related_topics": [],
                "connections": [],
                "evidence_chunk_ids": ["chunk:1"],
                "source_urls": ["https://example.com/1"],
                "module_ids": ["systems"],
                "confidence": 0.8,
            },
            {
                "id": "topic:system-design-fundamentals",
                "slug": "system-design-fundamentals",
                "label": "System Design Fundamentals",
                "aliases": ["System Design"],
                "study_guide_markdown": "Fundamentals guide",
                "concepts": [],
                "prerequisites": [],
                "related_topics": [],
                "connections": [],
                "evidence_chunk_ids": ["chunk:2"],
                "source_urls": ["https://example.com/2"],
                "module_ids": ["systems"],
                "confidence": 0.7,
            },
        ]

        canonical_topics, diagnostics = topic_validator.canonicalize_topics(topics)

        self.assertEqual(diagnostics["pruned_alias_count"], 1)
        fundamentals = next(
            topic for topic in canonical_topics if topic["label"] == "System Design Fundamentals"
        )
        self.assertEqual(fundamentals["aliases"], [])

    def test_canonicalize_topics_drops_unresolved_references(self):
        topics = [
            {
                "id": "topic:system-design",
                "slug": "system-design",
                "label": "System Design",
                "aliases": [],
                "study_guide_markdown": "System design guide",
                "concepts": [],
                "prerequisites": ["Unknown Topic"],
                "related_topics": ["Missing Area"],
                "connections": [{"label": "Imaginary Topic", "relation": "related", "rationale": ""}],
                "evidence_chunk_ids": ["chunk:1"],
                "source_urls": ["https://example.com/1"],
                "module_ids": ["systems"],
                "confidence": 0.8,
            }
        ]

        canonical_topics, _ = topic_validator.canonicalize_topics(topics)

        self.assertEqual(canonical_topics[0]["prerequisites"], [])
        self.assertEqual(canonical_topics[0]["related_topics"], [])
        self.assertEqual(canonical_topics[0]["connections"], [])


class BucketSynthesizerTests(unittest.TestCase):
    def test_synthesizer_returns_one_topic_per_ontology_topic(self):
        recursion_chunk = {
            "chunk_id": "chunk:recursion",
            "module_id": "recursion-dp",
            "module_title": "Recursion and DP",
            "resource_label": "Recursion Notes",
            "source_url": "https://example.com/recursion",
            "title": "Recursion",
            "heading_path": ["Recursion"],
            "text": "Recursion solves a problem by reducing it to smaller instances.",
        }
        greedy_chunk = {
            "chunk_id": "chunk:greedy",
            "module_id": "recursion-dp",
            "module_title": "Recursion and DP",
            "resource_label": "Greedy Notes",
            "source_url": "https://example.com/greedy",
            "title": "Greedy Algorithms",
            "heading_path": ["Greedy Algorithms"],
            "text": "Greedy algorithms make the locally optimal choice at each step.",
        }
        shared_chunk = {
            "chunk_id": "chunk:shared",
            "module_id": "recursion-dp",
            "module_title": "Recursion and DP",
            "resource_label": "Paradigm Comparison",
            "source_url": "https://example.com/shared",
            "title": "Paradigm Comparison",
            "heading_path": ["Paradigm Comparison"],
            "text": "Compare recursive search, dynamic programming, and greedy strategies.",
        }
        bucket = {
            "bucket_id": "recursive-and-optimization",
            "label": "Recursive and Optimization Paradigms",
            "summary": "Recursive decomposition and optimization strategies.",
            "topic_ids": ["recursion", "greedy-algorithms"],
            "topics": [
                {
                    "id": "recursion",
                    "label": "Recursion",
                    "aliases": ["Recursion Basics"],
                    "prerequisites": [],
                },
                {
                    "id": "greedy-algorithms",
                    "label": "Greedy Algorithms",
                    "aliases": ["Greedy Algorithm"],
                    "prerequisites": ["algorithms"],
                },
            ],
            "module_ids": ["recursion-dp"],
            "source_urls": [
                "https://example.com/recursion",
                "https://example.com/greedy",
                "https://example.com/shared",
            ],
            "topic_matches": {
                "recursion": [{"chunk": recursion_chunk, "score": 10}],
                "greedy-algorithms": [{"chunk": greedy_chunk, "score": 9}],
            },
            "general_chunks": [shared_chunk],
        }
        fake_response = {
            "topics": [
                {
                    "planning_topic_id": "recursion",
                    "label": "Recursion",
                    "aliases": ["Recursive Problem Solving"],
                    "concepts": ["Base case", "Recursive step"],
                    "prerequisites": [],
                    "related_topics": ["Greedy Algorithms"],
                    "connections": [
                        {
                            "label": "Greedy Algorithms",
                            "relation": "related",
                            "rationale": "Both are problem-solving paradigms.",
                        }
                    ],
                    "lesson_outline": {
                        "subtopic_titles": ["Base cases", "Recursive decomposition", "Practice patterns"],
                        "pattern_candidates": ["Recursive template"],
                        "practice_focus": ["Trace recursive calls", "Implement recursive solutions"],
                        "scope_notes": ["Keep the lesson on recursion rather than greedy choice proofs."],
                    },
                    "confidence": 0.88,
                },
                {
                    "planning_topic_id": "greedy-algorithms",
                    "label": "Greedy Algorithms",
                    "aliases": ["Greedy Strategy"],
                    "concepts": ["Local optimum", "Exchange argument"],
                    "prerequisites": ["Algorithms"],
                    "related_topics": ["Recursion"],
                    "connections": [
                        {
                            "label": "Recursion",
                            "relation": "related",
                            "rationale": "Both are compared in optimization units.",
                        }
                    ],
                    "lesson_outline": {
                        "subtopic_titles": ["Greedy choice property", "Proof techniques", "Canonical examples"],
                        "pattern_candidates": ["Exchange argument"],
                        "practice_focus": ["Spot greedy signals", "Compare greedy vs DP"],
                        "scope_notes": ["Stay on local-choice reasoning, not recursion mechanics."],
                    },
                    "confidence": 0.84,
                },
            ]
        }

        with patch.object(bucket_synthesizer, "cache_get", return_value=None):
            with patch.object(bucket_synthesizer, "cache_set") as mock_cache_set:
                with patch.object(
                    bucket_synthesizer,
                    "complete_prompt",
                    return_value=json.dumps(fake_response),
                ) as mock_complete:
                    topics = bucket_synthesizer.synthesize_bucket_topics([bucket])

        self.assertEqual([topic["label"] for topic in topics], ["Recursion", "Greedy Algorithms"])
        self.assertEqual(topics[0]["id"], "topic:recursion")
        self.assertIn("Recursion Basics", topics[0]["aliases"])
        self.assertIn("Greedy Algorithm", topics[1]["aliases"])
        self.assertCountEqual(
            topics[0]["evidence_chunk_ids"],
            ["chunk:recursion", "chunk:shared"],
        )
        self.assertIn("https://example.com/shared", topics[1]["source_urls"])
        self.assertEqual(
            topics[0]["lesson_outline"]["subtopic_titles"],
            ["Base cases", "Recursive decomposition", "Practice patterns"],
        )
        self.assertEqual(topics[1]["connections"][0]["relation"], "related")
        self.assertEqual(mock_complete.call_count, 1)
        mock_cache_set.assert_called_once()

    def test_synthesizer_repairs_invalid_json_before_retrying(self):
        bucket = {
            "bucket_id": "recursive-and-optimization",
            "label": "Recursive and Optimization Paradigms",
            "summary": "Recursive decomposition and optimization strategies.",
            "topic_ids": ["recursion"],
            "topics": [
                {
                    "id": "recursion",
                    "label": "Recursion",
                    "aliases": ["Recursion Basics"],
                    "prerequisites": [],
                }
            ],
            "module_ids": ["recursion-dp"],
            "source_urls": ["https://example.com/recursion"],
            "topic_matches": {
                "recursion": [
                    {
                        "chunk": {
                            "chunk_id": "chunk:recursion",
                            "module_id": "recursion-dp",
                            "module_title": "Recursion and DP",
                            "resource_label": "Recursion Notes",
                            "source_url": "https://example.com/recursion",
                            "title": "Recursion",
                            "heading_path": ["Recursion"],
                            "text": "Recursion solves a problem by reducing it to smaller instances.",
                        },
                        "score": 10,
                    }
                ]
            },
            "general_chunks": [],
        }
        malformed_response = """{
  "topics": [
    {
      "planning_topic_id": "recursion",
      "label": "Recursion",
      "aliases": ["Recursive Problem Solving"],
      "study_guide_lines": ["# Recursion", "Base cases stop the recursion]
    }
  ]
}"""
        repaired_response = {
            "topics": [
                {
                    "planning_topic_id": "recursion",
                    "label": "Recursion",
                    "aliases": ["Recursive Problem Solving"],
                    "concepts": ["Base case"],
                    "prerequisites": [],
                    "related_topics": [],
                    "connections": [],
                    "lesson_outline": {
                        "subtopic_titles": ["Base cases", "Recursive calls", "Practice"],
                        "pattern_candidates": [],
                        "practice_focus": ["Trace recursion"],
                        "scope_notes": ["Keep the lesson on recursion."],
                    },
                    "confidence": 0.9,
                }
            ]
        }

        with patch.object(bucket_synthesizer, "cache_get", return_value=None):
            with patch.object(bucket_synthesizer, "cache_set"):
                with patch.object(
                    bucket_synthesizer,
                    "complete_prompt",
                    side_effect=[malformed_response, json.dumps(repaired_response)],
                ) as mock_complete:
                    topics = bucket_synthesizer.synthesize_bucket_topics([bucket])

        self.assertEqual(topics[0]["label"], "Recursion")
        self.assertEqual(mock_complete.call_count, 2)

    def test_synthesizer_canonicalizes_known_references_and_drops_off_ontology_labels(self):
        bucket = {
            "bucket_id": "system-design-curriculum",
            "label": "System Design Curriculum",
            "summary": "System design fundamentals, large-scale systems, and interview execution.",
            "topic_ids": ["system-design-interview-preparation"],
            "topics": [
                {
                    "id": "system-design-interview-preparation",
                    "label": "System Design Interview Preparation",
                    "aliases": ["System Design Interview Prep"],
                    "prerequisites": ["system-design-fundamentals", "system-design"],
                }
            ],
            "module_ids": ["system-design"],
            "source_urls": ["https://example.com/system-design-interviews"],
            "topic_matches": {
                "system-design-interview-preparation": [
                    {
                        "chunk": {
                            "chunk_id": "chunk:sd-interviews",
                            "module_id": "system-design",
                            "module_title": "System Design",
                            "resource_label": "Interview Notes",
                            "source_url": "https://example.com/system-design-interviews",
                            "title": "System Design Interview Preparation",
                            "heading_path": ["System Design Interview Preparation"],
                            "text": "Practice clarifying requirements, trade-offs, and communication in system design interviews.",
                        },
                        "score": 10,
                    }
                ]
            },
            "general_chunks": [],
        }
        fake_response = {
            "topics": [
                {
                    "planning_topic_id": "system-design-interview-preparation",
                    "label": "System Design Interview Preparation",
                    "aliases": ["Distributed Design Interviews"],
                    "concepts": ["Clarifying requirements", "Trade-off analysis"],
                    "prerequisites": ["System Design Fundamentals"],
                    "related_topics": ["coding-interviews", "javascript"],
                    "connections": [
                        {
                            "label": "networking",
                            "relation": "related",
                            "rationale": "Networking trade-offs are common discussion material.",
                        },
                        {
                            "label": "react",
                            "relation": "related",
                            "rationale": "Frontend frameworks are out of scope here.",
                        },
                    ],
                    "lesson_outline": {
                        "subtopic_titles": ["Clarifying requirements", "Driving trade-off discussion", "Communicating architecture"],
                        "pattern_candidates": ["Answer loop"],
                        "practice_focus": ["Run interview drills"],
                        "scope_notes": ["Keep the scope on interview execution."],
                    },
                    "confidence": 0.82,
                }
            ]
        }

        with patch.object(bucket_synthesizer, "cache_get", return_value=None):
            with patch.object(bucket_synthesizer, "cache_set"):
                with patch.object(
                    bucket_synthesizer,
                    "complete_prompt",
                    return_value=json.dumps(fake_response),
                ):
                    topics = bucket_synthesizer.synthesize_bucket_topics([bucket])

        self.assertEqual(topics[0]["related_topics"], ["Coding Interview Preparation"])
        self.assertEqual(
            topics[0]["connections"],
            [
                {
                    "label": "Computer Networking",
                    "relation": "related",
                    "rationale": "Networking trade-offs are common discussion material.",
                }
            ],
        )

    def test_synthesizer_drops_prerequisite_connections(self):
        bucket = {
            "bucket_id": "system-design-curriculum",
            "label": "System Design Curriculum",
            "summary": "System design fundamentals, large-scale systems, and interview execution.",
            "topic_ids": ["system-design-interview-preparation"],
            "topics": [
                {
                    "id": "system-design-interview-preparation",
                    "label": "System Design Interview Preparation",
                    "aliases": ["System Design Interview Prep"],
                    "prerequisites": ["system-design-fundamentals", "system-design"],
                }
            ],
            "module_ids": ["system-design"],
            "source_urls": ["https://example.com/system-design-interviews"],
            "topic_matches": {
                "system-design-interview-preparation": [
                    {
                        "chunk": {
                            "chunk_id": "chunk:sd-interviews",
                            "module_id": "system-design",
                            "module_title": "System Design",
                            "resource_label": "Interview Notes",
                            "source_url": "https://example.com/system-design-interviews",
                            "title": "System Design Interview Preparation",
                            "heading_path": ["System Design Interview Preparation"],
                            "text": "Practice clarifying requirements, trade-offs, and communication in system design interviews.",
                        },
                        "score": 10,
                    }
                ]
            },
            "general_chunks": [],
        }
        fake_response = {
            "topics": [
                {
                    "planning_topic_id": "system-design-interview-preparation",
                    "label": "System Design Interview Preparation",
                    "aliases": [],
                    "concepts": ["Clarifying requirements"],
                    "prerequisites": ["System Design Fundamentals"],
                    "related_topics": [],
                    "connections": [
                        {
                            "label": "System Design Fundamentals",
                            "relation": "prerequisite",
                            "rationale": "This should be omitted.",
                        },
                        {
                            "label": "System Design",
                            "relation": "related",
                            "rationale": "Interview drills exercise the main design loop.",
                        },
                    ],
                    "lesson_outline": {
                        "subtopic_titles": ["Clarifying requirements", "Trade-off narration", "Interview structure"],
                        "pattern_candidates": ["Interview loop"],
                        "practice_focus": ["Practice design interviews"],
                        "scope_notes": ["Do not turn this into a systems fundamentals lesson."],
                    },
                    "confidence": 0.82,
                }
            ]
        }

        with patch.object(bucket_synthesizer, "cache_get", return_value=None):
            with patch.object(bucket_synthesizer, "cache_set"):
                with patch.object(
                    bucket_synthesizer,
                    "complete_prompt",
                    return_value=json.dumps(fake_response),
                ):
                    topics = bucket_synthesizer.synthesize_bucket_topics([bucket])

        self.assertEqual(
            topics[0]["connections"],
            [
                {
                    "label": "System Design",
                    "relation": "related",
                    "rationale": "Interview drills exercise the main design loop.",
                }
            ],
        )

    def test_bucket_prompt_includes_bucket_context_and_grouped_evidence(self):
        bucket = {
            "bucket_id": "recursive-and-optimization",
            "label": "Recursive and Optimization Paradigms",
            "summary": "Recursive decomposition and optimization strategies.",
            "topic_ids": ["recursion"],
            "topics": [
                {
                    "id": "recursion",
                    "label": "Recursion",
                    "aliases": ["Recursion Basics"],
                    "prerequisites": [],
                }
            ],
            "module_ids": ["recursion-dp"],
            "source_urls": ["https://example.com/recursion"],
            "topic_matches": {
                "recursion": [
                    {
                        "chunk": {
                            "chunk_id": "chunk:recursion",
                            "module_id": "recursion-dp",
                            "module_title": "Recursion and DP",
                            "resource_label": "Recursion Notes",
                            "source_url": "https://example.com/recursion",
                            "title": "Recursion",
                            "heading_path": ["Recursion"],
                            "text": "Recursion solves a problem by reducing it to smaller instances.",
                        },
                        "score": 10,
                    }
                ]
            },
            "general_chunks": [],
        }

        prompt = bucket_synthesizer._bucket_prompt(
            bucket,
            bucket_synthesizer._select_bucket_evidence(bucket),
        )

        self.assertIn("Recursive and Optimization Paradigms", prompt)
        self.assertIn('"planning_topic_id": "recursion"', prompt)
        self.assertIn("Resource label: Recursion Notes", prompt)
        self.assertIn("Produce exactly one topic object for every ontology topic listed below.", prompt)
        self.assertIn('"lesson_outline"', prompt)


class TopicLessonSynthesizerTests(unittest.TestCase):
    def test_synthesize_topic_lessons_builds_structured_lesson_and_references(self):
        topic = {
            "id": "topic:arrays",
            "planning_topic_id": "arrays",
            "label": "Arrays",
            "aliases": ["Array"],
            "concepts": ["Prefix Sum"],
            "prerequisites": ["Data Structures"],
            "related_topics": ["Two Pointers"],
            "connections": [],
            "evidence_chunk_ids": ["chunk:arrays", "chunk:practice"],
            "source_urls": ["https://example.com/arrays", "https://leetcode.com/problems/two-sum"],
            "module_ids": ["arrays-linked-lists"],
            "confidence": 0.9,
            "bucket_id": "linear-structures-and-patterns",
            "bucket_label": "Linear Structures and Patterns",
            "lesson_profile": {
                "family": "algorithmic",
                "allow_problem_items": True,
                "emphasis_sections": ["patterns", "pitfalls"],
                "practice_minimums": {"problem": 2, "exercise": 1, "total": 4},
            },
            "lesson_outline": {
                "subtopic_titles": ["Array operations", "Prefix sums", "In-place techniques"],
                "pattern_candidates": ["Prefix Sum", "Two-pointer scan"],
                "practice_focus": ["Implement array routines", "Solve subarray problems"],
                "scope_notes": ["Keep the lesson on arrays rather than linked lists."],
            },
        }
        direct_chunk = {
            "chunk_id": "chunk:arrays",
            "module_id": "arrays-linked-lists",
            "module_title": "Arrays and Linked Lists",
            "resource_label": "Array Notes",
            "source_url": "https://example.com/arrays",
            "title": "Arrays",
            "heading_path": ["Arrays"],
            "text": "Arrays support indexed access and common traversal patterns.",
        }
        practice_chunk = {
            "chunk_id": "chunk:practice",
            "module_id": "leetcode-export-arraystrings",
            "module_title": "LeetCode Arrays",
            "resource_label": "Two Sum Practice",
            "source_url": "https://leetcode.com/problems/two-sum",
            "title": "Two Sum",
            "heading_path": ["Two Sum"],
            "text": "Practice using arrays and hashing on a classic warm-up problem.",
        }
        bucket = {
            "bucket_id": "linear-structures-and-patterns",
            "label": "Linear Structures and Patterns",
            "summary": "Sequential structures and interview patterns.",
            "topic_ids": ["arrays"],
            "topics": [
                {
                    "id": "arrays",
                    "label": "Arrays",
                    "aliases": ["Array"],
                    "prerequisites": ["data-structures"],
                }
            ],
            "module_ids": ["arrays-linked-lists"],
            "source_urls": ["https://example.com/arrays", "https://leetcode.com/problems/two-sum"],
            "topic_matches": {
                "arrays": [{"chunk": direct_chunk, "score": 10}],
            },
            "general_chunks": [practice_chunk],
        }
        fake_response = {
            "introduction_lines": ["Arrays store same-type values in contiguous memory.", "They matter because indexed access is the default substrate for many interview problems."],
            "study_lines": ["Implement reads, writes, inserts, deletes, and traversals.", "Review when array problems become prefix-sum, two-pointer, or window problems."],
            "subtopics": [
                {
                    "title": "Array operations",
                    "summary_lines": ["Understand random access, resizing costs, and shifting work."],
                    "bullets": ["Read/write by index", "Insert/delete trade-offs"],
                },
                {
                    "title": "Prefix sums",
                    "summary_lines": ["Use cumulative sums to answer repeated range queries."],
                    "bullets": ["Build the prefix array", "Translate range sums to subtraction"],
                },
                {
                    "title": "In-place techniques",
                    "summary_lines": ["Practice mutation patterns that avoid extra memory."],
                    "bullets": ["Stable overwrite", "Two-index compaction"],
                },
            ],
            "patterns": [
                {
                    "name": "Prefix Sum",
                    "kind": "pattern",
                    "summary_lines": ["Precompute cumulative values once and reuse them for repeated queries."],
                    "signals": ["Many subarray sum queries", "Need O(1) range answers after setup"],
                }
            ],
            "common_pitfalls": ["Forgetting shifting costs on insert/delete."],
            "practice_items": [
                {
                    "kind": "problem",
                    "title": "Range Sum Query Warm-up",
                    "prompt_lines": ["Solve a subarray-sum problem with and without prefix sums."],
                    "difficulty": "intro",
                },
                {
                    "kind": "problem",
                    "title": "Two Sum",
                    "prompt_lines": ["Use arrays plus a companion structure to solve a classic lookup problem."],
                    "difficulty": "core",
                },
                {
                    "kind": "exercise",
                    "title": "Implement Dynamic Array Operations",
                    "prompt_lines": ["Code append, insert, and delete helpers and explain their costs."],
                    "difficulty": "core",
                },
                {
                    "kind": "drill",
                    "title": "Signal Spotting",
                    "prompt_lines": ["List the clues that suggest prefix sums or two pointers."],
                    "difficulty": "stretch",
                },
            ],
        }

        with patch.object(topic_lesson_synthesizer, "cache_get", return_value=None):
            with patch.object(topic_lesson_synthesizer, "cache_set") as mock_cache_set:
                with patch.object(
                    topic_lesson_synthesizer,
                    "complete_prompt",
                    return_value=json.dumps(fake_response),
                ):
                    topics, diagnostics = topic_lesson_synthesizer.synthesize_topic_lessons([topic], [bucket])

        self.assertEqual(diagnostics["generated_topic_lessons"], 1)
        lesson = topics[0]["lesson"]
        self.assertEqual(lesson["practice_items"][0]["kind"], "problem")
        self.assertEqual(
            [item["kind"] for item in lesson["references"]],
            ["primary", "practice"],
        )
        mock_cache_set.assert_called_once()


class TopicLessonValidatorTests(unittest.TestCase):
    def test_validate_topic_lessons_assembles_markdown_and_rebuilds_concepts(self):
        topics = [
            {
                "id": "topic:arrays",
                "label": "Arrays",
                "concepts": ["Prefix Sum"],
                "lesson_profile": {
                    "family": "algorithmic",
                    "allow_problem_items": True,
                    "emphasis_sections": ["patterns", "pitfalls"],
                    "practice_minimums": {"problem": 2, "exercise": 1, "total": 4},
                },
                "lesson": {
                    "introduction_markdown": "Arrays give constant-time indexed access.",
                    "study_markdown": "Implement core operations and compare patterns.",
                    "subtopics": [
                        {"title": "Operations", "summary_markdown": "Reads, writes, and shifts.", "bullets": ["Index access"]},
                        {"title": "Prefix sums", "summary_markdown": "Precompute running totals.", "bullets": ["Range queries"]},
                        {"title": "In-place work", "summary_markdown": "Mutate without extra memory.", "bullets": ["Compaction"]},
                    ],
                    "patterns": [
                        {"name": "Prefix Sum", "kind": "pattern", "summary_markdown": "Precompute cumulative totals.", "signals": ["Repeated range queries"]},
                    ],
                    "common_pitfalls": ["Ignoring shift costs."],
                    "practice_items": [
                        {"kind": "problem", "title": "Range Sum Query", "prompt_markdown": "Solve with prefix sums.", "difficulty": "intro"},
                        {"kind": "problem", "title": "Two Sum", "prompt_markdown": "Use indexed reasoning.", "difficulty": "core"},
                        {"kind": "exercise", "title": "Implement inserts", "prompt_markdown": "Code insert/delete helpers.", "difficulty": "core"},
                        {"kind": "drill", "title": "Pattern signals", "prompt_markdown": "List clues for prefix sums.", "difficulty": "stretch"},
                    ],
                    "references": [
                        {"label": "Array Notes", "url": "https://example.com/arrays", "kind": "primary"},
                    ],
                },
            }
        ]

        validated, diagnostics = topic_validator.validate_topic_lessons(topics)

        self.assertEqual(diagnostics["invalid_topic_count"], 0)
        self.assertEqual(validated[0]["study_guide_markdown"], validated[0]["lesson"]["lesson_markdown"])
        self.assertIn("## Introduction", validated[0]["study_guide_markdown"])
        self.assertIn("Operations", validated[0]["concepts"])

    def test_validate_topic_lessons_rejects_problem_items_for_non_algorithmic_topics(self):
        topics = [
            {
                "id": "topic:resume-writing",
                "label": "Resume Writing",
                "concepts": ["Resume bullets"],
                "lesson_profile": {
                    "family": "career",
                    "allow_problem_items": False,
                    "emphasis_sections": ["frameworks", "pitfalls"],
                    "practice_minimums": {"exercise": 1, "drill": 1, "checklist": 1, "total": 4},
                },
                "lesson": {
                    "introduction_markdown": "Resume writing packages your work into evidence.",
                    "study_markdown": "Rewrite bullets and tailor the document to roles.",
                    "subtopics": [
                        {"title": "Bullet writing", "summary_markdown": "Use action-result format.", "bullets": ["Action + impact"]},
                        {"title": "Tailoring", "summary_markdown": "Adjust for role relevance.", "bullets": ["Match role language"]},
                        {"title": "Proofreading", "summary_markdown": "Eliminate mistakes.", "bullets": ["Check formatting"]},
                    ],
                    "patterns": [
                        {"name": "Impact bullet formula", "kind": "framework", "summary_markdown": "Verb + work + measurable result.", "signals": ["Weak generic bullets"]},
                    ],
                    "common_pitfalls": ["Listing responsibilities without outcomes."],
                    "practice_items": [
                        {"kind": "problem", "title": "Resume Rewrite", "prompt_markdown": "This should not be allowed.", "difficulty": "core"},
                        {"kind": "exercise", "title": "Rewrite bullets", "prompt_markdown": "Rewrite 5 bullets.", "difficulty": "core"},
                        {"kind": "drill", "title": "Tailoring drill", "prompt_markdown": "Adapt for two job descriptions.", "difficulty": "core"},
                        {"kind": "checklist", "title": "Final review", "prompt_markdown": "Run the final checklist.", "difficulty": "intro"},
                    ],
                    "references": [
                        {"label": "Resume Guide", "url": "https://example.com/resume", "kind": "primary"},
                    ],
                },
            }
        ]

        with self.assertRaises(RuntimeError):
            topic_validator.validate_topic_lessons(topics)


if __name__ == "__main__":
    unittest.main()
