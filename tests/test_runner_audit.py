import sys
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PIPELINE_DIR = ROOT / "pipeline"

for path in (ROOT, PIPELINE_DIR):
    if str(path) not in sys.path:
        sys.path.insert(0, str(path))


import runner


class RunnerAuditTests(unittest.TestCase):
    def test_build_crawl_audit_counts_statuses_and_keeps_degraded_list(self):
        collected_resources = [
            {
                "module_id": "graphs",
                "module_title": "Graphs",
                "module_phase": "Core Track",
                "label": "BFS Notes",
                "resource_url": "https://example.com/bfs",
                "resolved_url": "https://example.com/bfs",
                "resource_type": "article",
                "status": "ok",
                "error": None,
                "title": "BFS Notes",
            },
            {
                "module_id": "graphs",
                "module_title": "Graphs",
                "module_phase": "Core Track",
                "label": "DFS Playlist",
                "resource_url": "https://example.com/dfs",
                "resolved_url": "https://example.com/dfs",
                "resource_type": "youtube_playlist",
                "status": "fallback",
                "error": None,
                "title": "DFS Playlist",
            },
            {
                "module_id": "review",
                "module_title": "Review",
                "module_phase": "Interview Loop",
                "label": "Interview Article",
                "resource_url": "https://example.com/interview",
                "resolved_url": "https://example.com/interview",
                "resource_type": "article",
                "status": "failed",
                "error": "HTTP 403",
                "title": "",
            },
        ]

        audit = runner._build_crawl_audit(collected_resources)

        self.assertEqual(audit["total_resources"], 3)
        self.assertEqual(audit["status_counts"], {"ok": 1, "fallback": 1, "failed": 1})
        self.assertEqual(len(audit["degraded_resources"]), 2)
        self.assertEqual(audit["degraded_resources"][0]["label"], "DFS Playlist")
        self.assertEqual(audit["degraded_resources"][1]["error"], "HTTP 403")

    def test_build_sources_skips_fallback_resources_and_low_signal_coursera_segments(self):
        collected_resources = [
            {
                "module_id": "search",
                "module_title": "Search",
                "module_phase": "Core Track",
                "label": "Binary Search Notes",
                "resource_url": "https://example.com/binary-search",
                "resolved_url": "https://example.com/binary-search",
                "resource_type": "article",
                "status": "ok",
                "title": "Binary Search Notes",
                "segments": [
                    {
                        "kind": "github_markdown",
                        "source_url": "https://raw.githubusercontent.com/example/repo/main/README.md",
                        "title": "README.md",
                        "heading_path": ["README.md"],
                        "text": "Binary search splits the search space in half.",
                    }
                ],
            },
            {
                "module_id": "search",
                "module_title": "Search",
                "module_phase": "Core Track",
                "label": "Lecture Redirect",
                "resource_url": "https://www.coursera.org/lecture/data-structures/dynamic-arrays-EwbnV",
                "resolved_url": "https://www.coursera.org/learn/data-structures",
                "resource_type": "coursera",
                "status": "ok",
                "title": "Data Structures | Coursera",
                "segments": [
                    {
                        "kind": "web_page",
                        "source_url": "https://www.coursera.org/learn/data-structures",
                        "title": "Data Structures | Coursera",
                        "heading_path": ["Data Structures | Coursera"],
                        "text": "Join for free and learn data structures.",
                    }
                ],
            },
            {
                "module_id": "review",
                "module_title": "Review",
                "module_phase": "Interview Loop",
                "label": "Interviewing.io",
                "resource_url": "https://interviewing.io",
                "resolved_url": "https://interviewing.io",
                "resource_type": "platform",
                "status": "fallback",
                "title": "Interviewing.io",
                "segments": [],
            },
        ]

        sources = runner._build_sources(collected_resources)

        self.assertEqual(len(sources), 1)
        self.assertEqual(sources[0]["title"], "Binary Search Notes")
        self.assertEqual(sources[0]["segment_title"], "README.md")

    def test_collect_local_export_resource_reads_item_json_without_scraping(self):
        with tempfile.TemporaryDirectory() as tmp:
            item_path = Path(tmp) / "item.json"
            item_path.write_text(
                '{"chapterTitle":"Greedy","item":{"id":"4529","title":"Greedy algorithms"},'
                '"content":{"kind":"article","title":"Greedy algorithms","textContent":"Greedy text"}}',
                encoding="utf-8",
            )

            collected = runner._collect_local_export_resource(
                {
                    "module_id": "leetcode-export-greedy",
                    "module_title": "LeetCode Crash Course: Greedy",
                    "module_phase": "Supplemental",
                    "resource": {
                        "label": "Greedy algorithms",
                        "url": "https://leetcode.com/explore/interview/card/leetcode-crash-course/709/greedy/4529/",
                        "sourcePath": str(item_path),
                    },
                }
            )

        self.assertEqual(collected["status"], "ok")
        self.assertEqual(collected["resource_type"], "local_export")
        self.assertEqual(collected["title"], "Greedy algorithms")
        self.assertEqual(collected["segments"][0]["heading_path"], ["Greedy", "Greedy algorithms"])
        self.assertEqual(collected["segments"][0]["text"], "Greedy text")


if __name__ == "__main__":
    unittest.main()
