import os
import sys
import types
import unittest
from pathlib import Path

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

    if "requests" not in sys.modules:
        requests_module = types.ModuleType("requests")
        requests_module.get = lambda *args, **kwargs: None
        sys.modules["requests"] = requests_module


_install_stub_modules()

from scraper import score_scrape_quality


class ScraperQualityTests(unittest.TestCase):
    def test_is_thin_true_when_total_chars_below_500(self):
        segments = [{"text": "Short content."}]
        result = score_scrape_quality(segments, "https://example.com")
        self.assertLess(result["total_chars"], 500)
        self.assertTrue(result["is_thin"])

    def test_is_thin_false_when_total_chars_at_or_above_500(self):
        segments = [{"text": "A" * 500}]
        result = score_scrape_quality(segments, "https://example.com")
        self.assertEqual(result["total_chars"], 500)
        self.assertFalse(result["is_thin"])

    def test_is_thin_false_when_total_chars_exceeds_500(self):
        segments = [{"text": "A" * 300}, {"text": "B" * 300}]
        result = score_scrape_quality(segments, "https://example.com")
        self.assertEqual(result["total_chars"], 600)
        self.assertFalse(result["is_thin"])

    def test_has_noise_signals_true_when_segment_contains_enable_javascript(self):
        segments = [{"text": "Please Enable JavaScript to continue."}]
        result = score_scrape_quality(segments, "https://example.com/js-page")
        self.assertTrue(result["has_noise_signals"])

    def test_has_noise_signals_true_for_each_noise_pattern(self):
        noise_cases = [
            "enable javascript",
            "cookie consent",
            "403 forbidden",
            "page not found",
            "access denied",
        ]
        for pattern in noise_cases:
            with self.subTest(pattern=pattern):
                segments = [{"text": f"Error: {pattern}. Please try again."}]
                result = score_scrape_quality(segments, "https://example.com")
                self.assertTrue(result["has_noise_signals"], f"Expected noise signal for: {pattern!r}")

    def test_has_noise_signals_false_when_no_noise(self):
        segments = [{"text": "This is clean educational content about binary search algorithms."}]
        result = score_scrape_quality(segments, "https://example.com/binary-search")
        self.assertFalse(result["has_noise_signals"])

    def test_segment_count_matches_list_length(self):
        segments = [{"text": "First segment."}, {"text": "Second segment."}, {"text": "Third segment."}]
        result = score_scrape_quality(segments, "https://example.com")
        self.assertEqual(result["segment_count"], 3)

    def test_total_chars_sums_all_segment_texts(self):
        segments = [{"text": "Hello"}, {"text": "World!!"}]
        result = score_scrape_quality(segments, "https://example.com")
        self.assertEqual(result["total_chars"], len("Hello") + len("World!!"))

    def test_empty_segments_returns_thin_with_zero_chars(self):
        result = score_scrape_quality([], "https://example.com/empty")
        self.assertEqual(result["segment_count"], 0)
        self.assertEqual(result["total_chars"], 0)
        self.assertTrue(result["is_thin"])
        self.assertFalse(result["has_noise_signals"])

    def test_url_is_preserved_in_result(self):
        url = "https://example.com/my-page"
        result = score_scrape_quality([], url)
        self.assertEqual(result["url"], url)

    def test_segments_with_missing_text_key_count_zero_chars(self):
        segments = [{"title": "No text key here"}, {"text": "Has text", "title": "Also has title"}]
        result = score_scrape_quality(segments, "https://example.com")
        self.assertEqual(result["total_chars"], len("Has text"))
        self.assertEqual(result["segment_count"], 2)

    def test_noise_detection_is_case_insensitive(self):
        segments = [{"text": "ERROR: 403 Forbidden — you do not have permission."}]
        result = score_scrape_quality(segments, "https://example.com/forbidden")
        self.assertTrue(result["has_noise_signals"])


if __name__ == "__main__":
    unittest.main()
