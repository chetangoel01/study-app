import base64
import os
import sys
import types
import unittest
from pathlib import Path
from unittest.mock import patch


ROOT = Path(__file__).resolve().parents[1]
PIPELINE_DIR = ROOT / "pipeline"

for path in (ROOT, PIPELINE_DIR):
    if str(path) not in sys.path:
        sys.path.insert(0, str(path))

os.environ.setdefault("OPENROUTER_API_KEY", "test-openrouter-key")


def _install_stub_modules() -> None:
    if "trafilatura" not in sys.modules:
        trafilatura = types.ModuleType("trafilatura")
        trafilatura.fetch_url = lambda url: None
        trafilatura.extract = lambda html: ""
        sys.modules["trafilatura"] = trafilatura

    if "pypdf" not in sys.modules:
        pypdf = types.ModuleType("pypdf")

        class DummyPdfReader:
            def __init__(self, *_args, **_kwargs) -> None:
                self.pages = []

        pypdf.PdfReader = DummyPdfReader
        sys.modules["pypdf"] = pypdf

    if "youtube_transcript_api" not in sys.modules:
        youtube_module = types.ModuleType("youtube_transcript_api")

        class DummyYouTubeTranscriptApi:
            @staticmethod
            def get_transcript(_video_id):
                return []

        youtube_module.YouTubeTranscriptApi = DummyYouTubeTranscriptApi
        sys.modules["youtube_transcript_api"] = youtube_module

    if "youtube_transcript_api._errors" not in sys.modules:
        errors_module = types.ModuleType("youtube_transcript_api._errors")

        class NoTranscriptFound(Exception):
            pass

        class TranscriptsDisabled(Exception):
            pass

        errors_module.NoTranscriptFound = NoTranscriptFound
        errors_module.TranscriptsDisabled = TranscriptsDisabled
        sys.modules["youtube_transcript_api._errors"] = errors_module


_install_stub_modules()

import build_study_data
import config
import graph_builder
import scraper
from url_classifier import UrlType


class MockResponse:
    def __init__(
        self,
        *,
        status_code=200,
        text="",
        content=b"",
        json_data=None,
        url="https://example.com",
        headers=None,
    ):
        self.status_code = status_code
        self.text = text
        self.content = content
        self._json_data = json_data
        self.url = url
        self.headers = headers or {}

    def raise_for_status(self) -> None:
        if self.status_code >= 400:
            raise RuntimeError(f"HTTP {self.status_code}")

    def json(self):
        if self._json_data is None:
            raise RuntimeError("Missing json payload")
        return self._json_data


class FakePdfPage:
    def __init__(self, text: str) -> None:
        self._text = text

    def extract_text(self) -> str:
        return self._text


class FakePdfReader:
    def __init__(self, *_args, **_kwargs) -> None:
        self.pages = [FakePdfPage("Page one"), FakePdfPage("Page two")]


class PipelineSourceConfigurationTests(unittest.TestCase):
    def test_stage1_seed_list_excludes_leetcode_crash_course_card_urls(self):
        crash = (
            "https://leetcode.com/explore/interview/card/"
            "leetcodes-interview-crash-course-data-structures-and-algorithms/703/arraystrings/"
        )
        self.assertTrue(config.pipeline_url_excluded_from_stage1_seeds(crash))
        self.assertFalse(
            config.pipeline_url_excluded_from_stage1_seeds("https://leetcode.com/problems/two-sum")
        )

    def test_stage1_seed_list_excludes_noisy_hosts(self):
        noisy = [
            "https://www.freecodecamp.org/news/sorting-algorithms-explained/",
            "https://www.topcoder.com/thrive/articles/Greedy%20Algorithms",
            "https://www.programiz.com/dsa/greedy-algorithm",
            "https://geni.us/q7svoz",
            "https://startupnextdoor.com/retaining-computer-science-knowledge/",
            "https://www.amazon.com/Cracking-Coding-Interview-Programming-Questions/dp/0984782850/",
            "https://archive.org/details/SomeArchiveItem",
            "https://www.khanacademy.org/computing/computer-science/algorithms",
        ]
        for url in noisy:
            self.assertTrue(config.pipeline_url_excluded_from_stage1_seeds(url), url)

    def test_pipeline_only_sources_include_user_repositories(self):
        expected_urls = {
            # GitHub repositories
            "https://github.com/nas5w/interview-guide",
            "https://github.com/yangshun/tech-interview-handbook",
            "https://github.com/kdn251/interviews",
            "https://github.com/sudheerj/reactjs-interview-questions",
            "https://github.com/yangshun/front-end-interview-handbook",
            "https://github.com/karanpratapsingh/system-design",
            "https://github.com/khangich/machine-learning-interview",
            "https://github.com/shashank88/system_design",
            "https://github.com/ashishps1/awesome-behavioral-interviews",
            "https://github.com/alirezadir/Machine-Learning-Interviews",
            "https://github.com/Chanda-Abdul/Several-Coding-Patterns-for-Solving-Data-Structures-and-Algorithms-Problems-during-Interviews",
            # DSA reference articles
            "https://en.wikipedia.org/wiki/Array_(data_structure)",
            "https://en.wikipedia.org/wiki/Hash_table",
            "https://en.wikipedia.org/wiki/Tree_(data_structure)",
            "https://en.wikipedia.org/wiki/Heap_(data_structure)",
            "https://en.wikipedia.org/wiki/Graph_traversal",
            "https://en.wikipedia.org/wiki/Dynamic_programming",
            "https://en.wikipedia.org/wiki/Greedy_algorithm",
            "https://en.wikipedia.org/wiki/Divide-and-conquer_algorithm",
            "https://en.wikipedia.org/wiki/Object-oriented_programming",
            "https://en.wikipedia.org/wiki/Object-oriented_design",
            "https://www.geeksforgeeks.org/recursion/",
            "https://en.wikipedia.org/wiki/Backtracking",
            "https://www.freecodecamp.org/news/sorting-algorithms-explained/",
            "https://www.freecodecamp.org/news/demystifying-dynamic-programming-3efafb8d4296/",
            "https://www.programiz.com/dsa/greedy-algorithm",
            "https://www.programiz.com/dsa/divide-and-conquer",
            # Systems and design concept references
            "https://en.wikipedia.org/wiki/Database",
            "https://en.wikipedia.org/wiki/Distributed_computing",
            "https://en.wikipedia.org/wiki/Concurrency_(computer_science)",
            "https://en.wikipedia.org/wiki/Cache_replacement_policies",
            "https://en.wikipedia.org/wiki/Load_balancing_(computing)",
            "https://en.wikipedia.org/wiki/API",
            "https://en.wikipedia.org/wiki/CAP_theorem",
            "https://en.wikipedia.org/wiki/Consistent_hashing",
            "https://en.wikipedia.org/wiki/Shard_(database_architecture)",
            "https://en.wikipedia.org/wiki/Cloud_computing",
            "https://en.wikipedia.org/wiki/Microservices",
            "https://www.geeksforgeeks.org/software-architecture-and-design/",
            "https://en.wikipedia.org/wiki/Computer_network",
            # Career resources
            "https://en.wikipedia.org/wiki/Site_reliability_engineering",
            "https://www.kalzumeus.com/2012/01/23/salary-negotiation/",
            "https://www.freecodecamp.org/news/writing-a-killer-software-engineering-resume-b11c91ef699d/",
        }
        configured_urls = {
            resource["url"]
            for module in build_study_data.PIPELINE_ONLY_MODULES
            for resource in module["resources"]
        }

        self.assertEqual(expected_urls, configured_urls)

    def test_pipeline_only_sources_do_not_change_public_payload_sections(self):
        payload = build_study_data.build_payload()
        public_ids = {module["id"] for module in payload["sections"]}
        pipeline_only_ids = {module["id"] for module in build_study_data.PIPELINE_ONLY_MODULES}

        self.assertTrue(pipeline_only_ids.isdisjoint(public_ids))


class GitHubScraperTests(unittest.TestCase):
    def test_github_repo_scrape_expands_selected_repo_docs(self):
        owner = "yangshun"
        repo = "tech-interview-handbook"
        repo_url = f"https://github.com/{owner}/{repo}"

        def fake_get(url, **kwargs):
            if url == f"https://api.github.com/repos/{owner}/{repo}":
                return MockResponse(
                    json_data={
                        "full_name": f"{owner}/{repo}",
                        "html_url": repo_url,
                        "description": "Interview notes",
                        "default_branch": "main",
                    }
                )
            if url == f"https://api.github.com/repos/{owner}/{repo}/git/trees/main?recursive=1":
                return MockResponse(
                    json_data={
                        "tree": [
                            {"type": "blob", "path": "README.md"},
                            {"type": "blob", "path": "docs/system-design.md"},
                            {"type": "blob", "path": "LICENSE"},
                        ]
                    }
                )
            if url == f"https://raw.githubusercontent.com/{owner}/{repo}/main/README.md":
                return MockResponse(text="# README\nUseful overview")
            if url == f"https://raw.githubusercontent.com/{owner}/{repo}/main/docs/system-design.md":
                return MockResponse(text="# System Design\nDeep content")
            raise AssertionError(f"Unexpected URL: {url}")

        with patch.object(scraper.requests, "get", side_effect=fake_get) as mock_get:
            result = scraper.scrape_url("https://github.com/yangshun/tech-interview-handbook")

        self.assertEqual(mock_get.call_count, 4)
        self.assertEqual(result.url_type, UrlType.GITHUB_REPO)
        self.assertEqual(result.status, "ok")
        self.assertIn("Repository file: README.md", result.content)
        self.assertIn("Repository file: docs/system-design.md", result.content)
        self.assertEqual(result.resolved_url, repo_url)

    def test_github_markdown_scrape_uses_raw_blob_url(self):
        url = (
            "https://github.com/jwasham/coding-interview-university/blob/master/"
            "programming-language-resources.md"
        )
        with patch.object(
            scraper.requests,
            "get",
            return_value=MockResponse(text="# Programming Languages\nReference material"),
        ):
            result = scraper.scrape_url(url)

        self.assertEqual(result.url_type, UrlType.GITHUB_MARKDOWN)
        self.assertEqual(result.status, "ok")
        self.assertIn("Reference material", result.content)
        self.assertEqual(
            result.resolved_url,
            "https://raw.githubusercontent.com/jwasham/coding-interview-university/master/programming-language-resources.md",
        )

    def test_github_markdown_scrape_stores_links_and_crawls_repeated_domains(self):
        url = (
            "https://github.com/example/interview-guide/blob/main/README.md"
        )
        markdown = """
# Interview Guide
[Binary Search](https://docs.example.com/binary-search)
[Depth First Search](https://docs.example.com/dfs)
[Offsite](https://other.example.com/overview)
"""

        def fake_link_scrape(link, depth=0):
            if link == "https://docs.example.com/binary-search":
                return scraper.ScrapeResult(
                    url=link,
                    url_type=UrlType.ARTICLE,
                    resolved_url=link,
                    content="Binary search content",
                    title="Binary Search",
                    og_description="",
                    status="ok",
                    error=None,
                    segments=[
                        {
                            "segment_id": "page:binary-search",
                            "kind": "web_page",
                            "source_url": link,
                            "title": "Binary Search",
                            "heading_path": ["Binary Search"],
                            "text": "Binary search content",
                        }
                    ],
                )
            if link == "https://docs.example.com/dfs":
                return scraper.ScrapeResult(
                    url=link,
                    url_type=UrlType.ARTICLE,
                    resolved_url=link,
                    content="DFS content",
                    title="Depth First Search",
                    og_description="",
                    status="ok",
                    error=None,
                    segments=[
                        {
                            "segment_id": "page:dfs",
                            "kind": "web_page",
                            "source_url": link,
                            "title": "Depth First Search",
                            "heading_path": ["Depth First Search"],
                            "text": "DFS content",
                        }
                    ],
                )
            if link == "https://other.example.com/overview":
                return scraper.ScrapeResult(
                    url=link,
                    url_type=UrlType.ARTICLE,
                    resolved_url=link,
                    content="Overview content",
                    title="Overview",
                    og_description="",
                    status="ok",
                    error=None,
                    segments=[
                        {
                            "segment_id": "page:overview",
                            "kind": "web_page",
                            "source_url": link,
                            "title": "Overview",
                            "heading_path": ["Overview"],
                            "text": "Overview content",
                        }
                    ],
                )
            raise AssertionError(f"Unexpected linked crawl: {link}")

        with patch.object(
            scraper.requests,
            "get",
            return_value=MockResponse(text=markdown),
        ):
            with patch.object(scraper, "_scrape_url", side_effect=fake_link_scrape) as mock_scrape:
                result = scraper._scrape_github_markdown(url)

        self.assertEqual(result.status, "ok")
        self.assertEqual(mock_scrape.call_count, 3)
        self.assertEqual(
            result.segments[0]["links"],
            [
                "https://docs.example.com/binary-search",
                "https://docs.example.com/dfs",
                "https://other.example.com/overview",
            ],
        )
        self.assertEqual(len(result.segments), 4)
        self.assertIn("Linked source: https://docs.example.com/binary-search", result.content)
        self.assertIn("Linked source: https://docs.example.com/dfs", result.content)
        self.assertIn("Linked source: https://other.example.com/overview", result.content)

    def test_github_pdf_scrape_reads_extracted_text(self):
        url = (
            "https://github.com/jwasham/coding-interview-university/blob/main/"
            "extras/cheat%20sheets/system-design.pdf"
        )
        with patch.object(scraper.requests, "get", return_value=MockResponse(content=b"%PDF-1.4")):
            with patch.object(scraper, "PdfReader", FakePdfReader):
                result = scraper.scrape_url(url)

        self.assertEqual(result.url_type, UrlType.GITHUB_PDF)
        self.assertEqual(result.status, "ok")
        self.assertIn("Page one", result.content)
        self.assertIn("Page two", result.content)
        self.assertEqual(
            result.resolved_url,
            "https://raw.githubusercontent.com/jwasham/coding-interview-university/main/extras/cheat%20sheets/system-design.pdf",
        )

    def test_article_scrape_crawls_same_host_pages(self):
        start_url = "https://docs.example.com/guide"
        child_url = "https://docs.example.com/guide/setup"

        html_pages = {
            start_url: """
                <html>
                  <head><title>Guide</title></head>
                  <body>
                    <a href="/guide/setup">Setup</a>
                    <a href="https://other.example.com/offsite">Offsite</a>
                  </body>
                </html>
            """,
            child_url: """
                <html>
                  <head><title>Setup</title></head>
                  <body>
                    <p>Setup details</p>
                  </body>
                </html>
            """,
        }

        def fake_get(url, **kwargs):
            normalized = url.rstrip("/")
            html = html_pages.get(normalized)
            if html is None:
                raise AssertionError(f"Unexpected URL: {url}")
            return MockResponse(
                text=html,
                url=normalized,
                headers={"Content-Type": "text/html; charset=utf-8"},
            )

        def fake_extract(html_text):
            if "Guide" in html_text:
                return "Guide intro"
            if "Setup" in html_text:
                return "Setup details"
            return ""

        with patch.object(scraper.requests, "get", side_effect=fake_get):
            with patch.object(scraper.trafilatura, "extract", side_effect=fake_extract):
                result = scraper.scrape_url(start_url)

        self.assertEqual(result.url_type, UrlType.ARTICLE)
        self.assertEqual(result.status, "ok")
        self.assertIn("Source page: https://docs.example.com/guide", result.content)
        self.assertIn("Source page: https://docs.example.com/guide/setup", result.content)
        self.assertIn("Guide intro", result.content)
        self.assertIn("Setup details", result.content)

    def test_youtube_unexpected_transcript_failure_falls_back(self):
        url = "https://www.youtube.com/watch?v=iOq5kSKqeR4"

        with patch.object(scraper.YouTubeTranscriptApi, "fetch", side_effect=RuntimeError("blocked"), create=True):
            with patch.object(
                scraper.requests,
                "get",
                return_value=MockResponse(
                    text="""
                        <html>
                          <head>
                            <title>Asymptotic Notation</title>
                            <meta name="description" content="Complexity overview" />
                          </head>
                        </html>
                    """,
                    url=url,
                    headers={"Content-Type": "text/html; charset=utf-8"},
                ),
            ):
                result = scraper.scrape_url(url)

        self.assertEqual(result.url_type, UrlType.YOUTUBE_VIDEO)
        self.assertEqual(result.status, "fallback")
        self.assertEqual(result.resolved_url, url)
        self.assertEqual(result.title, "Asymptotic Notation")
        self.assertEqual(result.og_description, "Complexity overview")

    def test_shortlink_failed_nested_scrape_degrades_to_fallback(self):
        short_url = "https://geni.us/q7svoz"
        resolved_url = "https://example.com/patterns"
        calls = 0

        def fake_get(url, **kwargs):
            nonlocal calls
            calls += 1
            if calls == 1:
                return MockResponse(
                    text="""
                        <html>
                          <head>
                            <title>Coding Interview Patterns</title>
                            <meta name="description" content="Book landing page" />
                          </head>
                        </html>
                    """,
                    url=resolved_url,
                    headers={"Content-Type": "text/html; charset=utf-8"},
                )
            return MockResponse(status_code=500, url=resolved_url)

        with patch.object(scraper.requests, "get", side_effect=fake_get):
            result = scraper.scrape_url(short_url)

        self.assertEqual(result.url_type, UrlType.ARTICLE)
        self.assertEqual(result.status, "fallback")
        self.assertEqual(result.resolved_url, resolved_url)
        self.assertEqual(result.title, "Coding Interview Patterns")
        self.assertEqual(result.og_description, "Book landing page")

    def test_coursera_lecture_redirect_to_course_page_degrades_to_fallback(self):
        lecture_url = "https://www.coursera.org/lecture/data-structures/dynamic-arrays-EwbnV"

        with patch.object(
            scraper.requests,
            "get",
            return_value=MockResponse(
                text="""
                    <html>
                      <head>
                        <title>Data Structures | Coursera</title>
                        <meta name="description" content="Join for free and learn data structures." />
                      </head>
                    </html>
                """,
                url="https://www.coursera.org/learn/data-structures",
                headers={"Content-Type": "text/html; charset=utf-8"},
            ),
        ):
            result = scraper.scrape_url(lecture_url)

        self.assertEqual(result.url_type, UrlType.COURSERA)
        self.assertEqual(result.status, "fallback")
        self.assertEqual(result.resolved_url, "https://www.coursera.org/learn/data-structures")
        self.assertEqual(result.segments, [])


class GraphBuilderTests(unittest.TestCase):
    def test_graph_includes_resource_and_concept_nodes(self):
        modules = {
            "graphs": {
                "module_id": "graphs",
                "resources": [
                    {
                        "label": "Graph Traversal Notes",
                        "url": "https://example.com/graphs",
                        "summary": "BFS and DFS overview",
                        "type": "article",
                        "difficulty": "medium",
                        "concepts": ["Breadth-First Search", "Depth-First Search", "Graph Traversal"],
                    }
                ],
            }
        }

        graph = graph_builder.build_knowledge_graph(modules)
        kinds = {node["kind"] for node in graph["nodes"]}
        edge_types = {edge["type"] for edge in graph["edges"]}

        self.assertIn("resource", kinds)
        self.assertIn("concept", kinds)
        self.assertIn("covers", edge_types)

    def test_graph_links_related_resources_by_shared_concepts(self):
        modules = {
            "graphs": {
                "module_id": "graphs",
                "resources": [
                    {
                        "label": "Graph Basics",
                        "url": "https://example.com/a",
                        "summary": "Shared traversal concepts",
                        "type": "article",
                        "difficulty": "easy",
                        "concepts": ["Breadth-First Search", "Graph Traversal"],
                    },
                    {
                        "label": "Traversal Practice",
                        "url": "https://example.com/b",
                        "summary": "More shared traversal concepts",
                        "type": "article",
                        "difficulty": "medium",
                        "concepts": ["Breadth-First Search", "Topological Sort"],
                    },
                ],
            }
        }

        graph = graph_builder.build_knowledge_graph(modules)
        related_edges = [edge for edge in graph["edges"] if edge["type"] == "related-resource"]

        self.assertEqual(len(related_edges), 1)
        self.assertEqual(related_edges[0]["shared_concepts"], 1)

    def test_graph_links_related_concepts_by_shared_resources(self):
        modules = {
            "graphs": {
                "module_id": "graphs",
                "resources": [
                    {
                        "label": "Graph Basics",
                        "url": "https://example.com/a",
                        "summary": "Shared traversal concepts",
                        "type": "article",
                        "difficulty": "easy",
                        "concepts": ["Breadth-First Search", "Graph Traversal"],
                    },
                    {
                        "label": "Traversal Practice",
                        "url": "https://example.com/b",
                        "summary": "Same pair appears again",
                        "type": "article",
                        "difficulty": "medium",
                        "concepts": ["Breadth-First Search", "Graph Traversal", "Topological Sort"],
                    },
                ],
            }
        }

        graph = graph_builder.build_knowledge_graph(modules)
        concept_edges = [edge for edge in graph["edges"] if edge["type"] == "related-concept"]

        self.assertTrue(
            any(
                edge["shared_resources"] == 2
                and edge["from"] == "concept:breadth-first-search"
                and edge["to"] == "concept:graph-traversal"
                for edge in concept_edges
            )
        )


if __name__ == "__main__":
    unittest.main()
