import sys
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PIPELINE_DIR = ROOT / "pipeline"

for path in (ROOT, PIPELINE_DIR):
    if str(path) not in sys.path:
        sys.path.insert(0, str(path))


import export_graph_views


class GraphExportTests(unittest.TestCase):
    def test_build_graph_markdown_includes_bucket_and_prerequisite_views(self):
        knowledge_base = {
            "stats": {
                "total_topics": 2,
                "total_topic_edges": 1,
                "covered_planning_topics": 2,
                "total_planning_topics": 2,
                "missing_topic_references": 0,
                "ambiguous_topic_references": 0,
                "dropped_prerequisite_cycles": 0,
            },
            "bucket_diagnostics": {
                "bucket_chunk_counts": {
                    "foundations": 4,
                    "advanced": 3,
                }
            },
            "curriculum_buckets": [
                {
                    "bucket_id": "foundations",
                    "label": "Foundations",
                    "summary": "Core concepts.",
                    "topic_ids": ["programming-fundamentals"],
                },
                {
                    "bucket_id": "advanced",
                    "label": "Advanced",
                    "summary": "Applied concepts.",
                    "topic_ids": ["algorithms"],
                },
            ],
            "topics": [
                {
                    "id": "programming-fundamentals",
                    "label": "Programming Fundamentals",
                    "bucket_id": "foundations",
                },
                {
                    "id": "algorithms",
                    "label": "Algorithms",
                    "bucket_id": "advanced",
                },
            ],
            "topic_edges": [
                {
                    "from": "programming-fundamentals",
                    "to": "algorithms",
                    "type": "prerequisite",
                }
            ],
        }

        markdown = export_graph_views.build_graph_markdown(knowledge_base)

        self.assertIn("# Knowledge Graph", markdown)
        self.assertIn("## Bucket Overview", markdown)
        self.assertIn("## Prerequisite DAG", markdown)
        self.assertIn("flowchart LR", markdown)
        self.assertIn("flowchart TB", markdown)
        self.assertIn("Programming Fundamentals", markdown)
        self.assertIn("Algorithms", markdown)

    def test_build_graph_markdown_includes_focus_topic_review_when_present(self):
        knowledge_base = {
            "stats": {
                "total_topics": 2,
                "total_topic_edges": 1,
                "covered_planning_topics": 2,
                "total_planning_topics": 2,
                "missing_topic_references": 0,
                "ambiguous_topic_references": 0,
                "dropped_prerequisite_cycles": 0,
            },
            "bucket_diagnostics": {
                "bucket_chunk_counts": {
                    "linear": 6,
                }
            },
            "curriculum_buckets": [
                {
                    "bucket_id": "linear",
                    "label": "Linear",
                    "summary": "Linear structures.",
                    "topic_ids": ["data-structures", "arrays"],
                },
            ],
            "topics": [
                {
                    "id": "data-structures",
                    "label": "Data Structures",
                    "bucket_id": "linear",
                    "bucket_label": "Linear",
                },
                {
                    "id": "arrays",
                    "label": "Arrays",
                    "bucket_id": "linear",
                    "bucket_label": "Linear",
                    "related_topics": ["Two Pointers"],
                    "lesson": {
                        "introduction_markdown": "Arrays store values contiguously.",
                        "study_markdown": "Practice in-place updates.",
                        "subtopics": [
                            {"title": "Array basics"},
                            {"title": "Prefix sums"},
                            {"title": "In-place operations"},
                        ],
                        "patterns": [
                            {"name": "Prefix Sum", "summary_markdown": "Precompute running totals."},
                        ],
                        "practice_items": [
                            {"kind": "problem", "difficulty": "core", "title": "Two Sum"},
                            {"kind": "exercise", "difficulty": "intro", "title": "Implement a dynamic array"},
                            {"kind": "checklist", "difficulty": "core", "title": "Array review"},
                        ],
                        "references": [
                            {"kind": "primary", "label": "Arrays", "url": "https://example.com/arrays"},
                        ],
                    },
                },
            ],
            "topic_edges": [
                {
                    "from": "data-structures",
                    "to": "arrays",
                    "type": "prerequisite",
                }
            ],
        }

        markdown = export_graph_views.build_graph_markdown(knowledge_base, focus_topic_label="Arrays")

        self.assertIn("## Focus Topic Review", markdown)
        self.assertIn("### Arrays", markdown)
        self.assertIn("#### Lesson Snapshot", markdown)
        self.assertIn("Prefix Sum", markdown)
        self.assertIn("Two Sum", markdown)
        self.assertIn("flowchart LR", markdown)


if __name__ == "__main__":
    unittest.main()
