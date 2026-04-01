import os
import sys
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PIPELINE_DIR = ROOT / "pipeline"

for path in (ROOT, PIPELINE_DIR):
    if str(path) not in sys.path:
        sys.path.insert(0, str(path))

os.environ.setdefault("OPENROUTER_API_KEY", "test-openrouter-key")


import planning_graph


class PlanningGraphTests(unittest.TestCase):
    def test_default_ontology_maps_programming_language_fundamentals_alias(self):
        topics = [
            {
                "id": "topic:programming-language-fundamentals",
                "label": "Programming Language Fundamentals",
                "aliases": [],
                "concepts": [],
                "prerequisites": [],
                "related_topics": [],
                "connections": [],
                "module_ids": ["programming"],
                "source_urls": ["https://example.com/programming-language-fundamentals"],
            }
        ]

        result = planning_graph.build_planning_graph(topics)

        self.assertEqual(
            result["planning_mappings"][0]["planning_topic_ids"],
            ["programming-fundamentals"],
        )
        self.assertEqual(result["planning_mappings"][0]["selection_source"], "primary")

    def test_default_ontology_maps_sliding_window_as_primary_pattern_topic(self):
        topics = [
            {
                "id": "topic:sliding-window",
                "label": "Sliding Window",
                "aliases": [],
                "concepts": ["Arrays", "Hash Maps"],
                "prerequisites": [],
                "related_topics": [],
                "connections": [],
                "module_ids": ["patterns"],
                "source_urls": ["https://example.com/sliding-window"],
            }
        ]

        result = planning_graph.build_planning_graph(topics)

        self.assertEqual(
            result["planning_mappings"][0]["planning_topic_ids"],
            ["sliding-window"],
        )
        self.assertEqual(result["planning_mappings"][0]["selection_source"], "primary")

    def test_default_ontology_maps_algorithm_design_canvas_to_whiteboard_coding(self):
        topics = [
            {
                "id": "topic:algorithm-design-canvas",
                "label": "Algorithm Design Canvas",
                "aliases": [],
                "concepts": ["Time Complexity Analysis", "Whiteboard Communication"],
                "prerequisites": [],
                "related_topics": [],
                "connections": [],
                "module_ids": ["setup-habits"],
                "source_urls": ["https://example.com/algorithm-design-canvas"],
            }
        ]

        result = planning_graph.build_planning_graph(topics)

        self.assertEqual(
            result["planning_mappings"][0]["planning_topic_ids"],
            ["whiteboard-coding"],
        )
        self.assertEqual(result["planning_mappings"][0]["selection_source"], "primary")

    def test_default_ontology_maps_python_dsa_topic_to_data_structures(self):
        topics = [
            {
                "id": "topic:python-dsa",
                "label": "Data Structures and Algorithms in Python",
                "aliases": [],
                "concepts": ["Pythonic Implementation", "Hash Table Implementation"],
                "prerequisites": [],
                "related_topics": [],
                "connections": [],
                "module_ids": ["setup-habits"],
                "source_urls": ["https://example.com/python-dsa"],
            }
        ]

        result = planning_graph.build_planning_graph(topics)

        self.assertEqual(
            result["planning_mappings"][0]["planning_topic_ids"],
            ["data-structures"],
        )
        self.assertEqual(result["planning_mappings"][0]["selection_source"], "primary")

    def test_default_ontology_maps_flask_deployment_to_devops(self):
        topics = [
            {
                "id": "topic:flask-deployment",
                "label": "Flask Web Application Deployment",
                "aliases": [],
                "concepts": ["Docker Containerization", "WSGI Server"],
                "prerequisites": [],
                "related_topics": [],
                "connections": [],
                "module_ids": ["setup-habits"],
                "source_urls": ["https://example.com/flask-deployment"],
            }
        ]

        result = planning_graph.build_planning_graph(topics)

        self.assertEqual(
            result["planning_mappings"][0]["planning_topic_ids"],
            ["devops-and-deployment"],
        )
        self.assertEqual(result["planning_mappings"][0]["selection_source"], "primary")

    def test_load_curriculum_ontology_rejects_cycles(self):
        ontology = {
            "version": 1,
            "topics": [
                {"id": "a", "label": "A", "aliases": [], "prerequisites": ["b"]},
                {"id": "b", "label": "B", "aliases": [], "prerequisites": ["a"]},
            ],
        }

        with self.assertRaises(RuntimeError):
            planning_graph.load_curriculum_ontology(ontology)

    def test_build_planning_graph_maps_topics_into_curated_ontology(self):
        ontology = {
            "version": 1,
            "topics": [
                {"id": "algorithms", "label": "Algorithms", "aliases": [], "prerequisites": []},
                {"id": "data-structures", "label": "Data Structures", "aliases": [], "prerequisites": []},
                {
                    "id": "technical-interview-preparation",
                    "label": "Technical Interview Preparation",
                    "aliases": ["Tech Interview Prep"],
                    "prerequisites": ["algorithms", "data-structures"],
                },
            ],
        }
        topics = [
            {
                "id": "topic:algorithms",
                "label": "Algorithms",
                "aliases": [],
                "concepts": [],
                "prerequisites": [],
                "related_topics": [],
                "connections": [],
                "module_ids": ["algorithms"],
                "source_urls": ["https://example.com/algorithms"],
            },
            {
                "id": "topic:data-structures",
                "label": "Data Structures",
                "aliases": [],
                "concepts": [],
                "prerequisites": [],
                "related_topics": [],
                "connections": [],
                "module_ids": ["data-structures"],
                "source_urls": ["https://example.com/data-structures"],
            },
            {
                "id": "topic:technical-interview-preparation",
                "label": "Technical Interview Preparation",
                "aliases": ["Engineering Interview Preparation"],
                "concepts": [],
                "prerequisites": ["Algorithms", "Data Structures"],
                "related_topics": [],
                "connections": [],
                "module_ids": ["review-interview"],
                "source_urls": ["https://example.com/interviews"],
            },
            {
                "id": "topic:unmapped",
                "label": "Dynamic Programming",
                "aliases": [],
                "concepts": [],
                "prerequisites": [],
                "related_topics": [],
                "connections": [],
                "module_ids": ["recursion-dp"],
                "source_urls": ["https://example.com/dp"],
            },
        ]

        result = planning_graph.build_planning_graph(topics, ontology)

        validation = result["planning_validation"]
        self.assertEqual(validation["total_planning_topics"], 3)
        self.assertEqual(validation["covered_planning_topics"], 3)
        self.assertEqual(validation["unmapped_synthesized_topics"], 1)
        self.assertEqual(validation["total_planning_edges"], 2)

        planning_topics = {topic["planning_topic_id"]: topic for topic in result["planning_topics"]}
        self.assertEqual(
            planning_topics["technical-interview-preparation"]["mapped_topic_ids"],
            ["topic:technical-interview-preparation"],
        )
        self.assertEqual(
            planning_topics["algorithms"]["mapped_topic_ids"],
            ["topic:algorithms"],
        )
        self.assertEqual(
            planning_topics["data-structures"]["mapped_topic_ids"],
            ["topic:data-structures"],
        )

        planning_edges = {
            (edge["from"], edge["to"], edge["type"])
            for edge in result["planning_topic_edges"]
        }
        self.assertEqual(
            planning_edges,
            {
                ("planning:algorithms", "planning:technical-interview-preparation", "prerequisite"),
                ("planning:data-structures", "planning:technical-interview-preparation", "prerequisite"),
            },
        )

    def test_build_planning_graph_does_not_count_prerequisite_mentions_as_coverage(self):
        ontology = {
            "version": 1,
            "topics": [
                {"id": "big-o-notation", "label": "Big O Notation", "aliases": [], "prerequisites": []},
                {"id": "recursion", "label": "Recursion", "aliases": [], "prerequisites": []},
            ],
        }
        topics = [
            {
                "id": "topic:aa-tree",
                "label": "AA tree",
                "aliases": ["Andersson tree"],
                "concepts": ["Self-balancing binary search tree"],
                "prerequisites": ["Big O Notation"],
                "related_topics": ["Recursion"],
                "connections": [],
                "module_ids": ["trees"],
                "source_urls": ["https://example.com/aa-tree"],
            }
        ]

        result = planning_graph.build_planning_graph(topics, ontology)

        self.assertEqual(result["planning_mappings"][0]["planning_topic_ids"], [])
        self.assertEqual(result["planning_validation"]["covered_planning_topics"], 0)

    def test_build_planning_graph_keeps_multiple_strong_primary_matches(self):
        ontology = {
            "version": 1,
            "topics": [
                {"id": "recursion", "label": "Recursion", "aliases": [], "prerequisites": []},
                {
                    "id": "divide-and-conquer",
                    "label": "Divide and Conquer",
                    "aliases": ["Divide and Conquer (Recursive)"],
                    "prerequisites": [],
                },
            ],
        }
        topics = [
            {
                "id": "topic:recursion",
                "label": "Recursion",
                "aliases": ["Recursive Problem Solving", "Divide and Conquer (Recursive)"],
                "concepts": [],
                "prerequisites": [],
                "related_topics": [],
                "connections": [],
                "module_ids": ["recursion-dp"],
                "source_urls": ["https://example.com/recursion"],
            }
        ]

        result = planning_graph.build_planning_graph(topics, ontology)

        self.assertEqual(
            result["planning_mappings"][0]["planning_topic_ids"],
            ["recursion", "divide-and-conquer"],
        )
        covered_ids = {
            topic["planning_topic_id"]
            for topic in result["planning_topics"]
            if topic["covered"]
        }
        self.assertEqual(covered_ids, {"recursion", "divide-and-conquer"})

    def test_build_planning_graph_does_not_promote_concept_mentions_to_primary_coverage(self):
        ontology = {
            "version": 1,
            "topics": [
                {"id": "algorithms", "label": "Algorithms", "aliases": [], "prerequisites": []},
                {
                    "id": "behavioral-interview-preparation",
                    "label": "Behavioral Interview Preparation",
                    "aliases": [],
                    "prerequisites": [],
                },
                {
                    "id": "system-design-fundamentals",
                    "label": "System Design Fundamentals",
                    "aliases": [],
                    "prerequisites": [],
                },
                {
                    "id": "coding-interview-preparation",
                    "label": "Coding Interview Preparation",
                    "aliases": [],
                    "prerequisites": ["algorithms"],
                },
            ],
        }
        topics = [
            {
                "id": "topic:coding-interview-preparation",
                "label": "Coding Interview Preparation",
                "aliases": [],
                "concepts": [
                    "Algorithms",
                    "Behavioral Interview Preparation",
                    "System Design Fundamentals",
                ],
                "prerequisites": [],
                "related_topics": [],
                "connections": [],
                "module_ids": ["review-interview"],
                "source_urls": ["https://example.com/interviews"],
            }
        ]

        result = planning_graph.build_planning_graph(topics, ontology)

        self.assertEqual(
            result["planning_mappings"][0]["planning_topic_ids"],
            ["coding-interview-preparation"],
        )
        covered_ids = {
            topic["planning_topic_id"]
            for topic in result["planning_topics"]
            if topic["covered"]
        }
        self.assertEqual(covered_ids, {"coding-interview-preparation"})

    def test_build_planning_graph_rejects_close_evidence_only_tie(self):
        ontology = {
            "version": 1,
            "topics": [
                {"id": "algorithms", "label": "Algorithms", "aliases": [], "prerequisites": []},
                {"id": "data-structures", "label": "Data Structures", "aliases": [], "prerequisites": []},
            ],
        }
        topics = [
            {
                "id": "topic:study-guide",
                "label": "Study Guide",
                "aliases": [],
                "concepts": ["Algorithms", "Data Structures"],
                "prerequisites": [],
                "related_topics": [],
                "connections": [],
                "module_ids": ["review"],
                "source_urls": ["https://example.com/study-guide"],
            }
        ]

        result = planning_graph.build_planning_graph(topics, ontology)

        self.assertEqual(result["planning_mappings"][0]["planning_topic_ids"], [])
        self.assertEqual(result["planning_mappings"][0]["selection_source"], "none")

    def test_build_planning_graph_allows_clear_evidence_only_fallback(self):
        ontology = {
            "version": 1,
            "topics": [
                {"id": "algorithms", "label": "Algorithms", "aliases": [], "prerequisites": []},
                {"id": "data-structures", "label": "Data Structures", "aliases": [], "prerequisites": []},
            ],
        }
        topics = [
            {
                "id": "topic:algorithm-cheatsheet",
                "label": "Algorithm Cheatsheet",
                "aliases": [],
                "concepts": ["Algorithms", "Algorithms", "Algorithms", "Data Structures"],
                "prerequisites": [],
                "related_topics": [],
                "connections": [],
                "module_ids": ["review"],
                "source_urls": ["https://example.com/algorithm-cheatsheet"],
            }
        ]

        result = planning_graph.build_planning_graph(topics, ontology)

        self.assertEqual(result["planning_mappings"][0]["planning_topic_ids"], ["algorithms"])
        self.assertEqual(result["planning_mappings"][0]["selection_source"], "evidence")


if __name__ == "__main__":
    unittest.main()
