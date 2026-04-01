import sys
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import download_leetcode_course as downloader


class LeetCodeDownloaderTests(unittest.TestCase):
    def test_parse_card_slug_from_root_card_url(self):
        slug = downloader.parse_card_slug(
            "https://leetcode.com/explore/interview/card/leetcodes-interview-crash-course-data-structures-and-algorithms/"
        )
        self.assertEqual(slug, "leetcodes-interview-crash-course-data-structures-and-algorithms")

    def test_load_cookie_header_parses_cookie_pairs(self):
        jar = downloader.load_cookie_header("LEETCODE_SESSION=abc123; csrftoken=xyz789")
        cookies = {cookie.name: cookie.value for cookie in jar}

        self.assertEqual(cookies["LEETCODE_SESSION"], "abc123")
        self.assertEqual(cookies["csrftoken"], "xyz789")

    def test_item_fetch_plan_prefers_article_when_available(self):
        plan = downloader.item_fetch_plan(
            {
                "article": {"id": "article-1", "title": "Intro"},
                "htmlArticle": {"id": "html-1"},
                "video": {"id": "video-1"},
            }
        )

        self.assertIsNotNone(plan)
        assert plan is not None
        self.assertEqual(plan.kind, "article")
        self.assertEqual(plan.operation_name, "GetArticle")
        self.assertEqual(plan.variable_name, "articleId")
        self.assertEqual(plan.variable_value, "article-1")

    def test_item_fetch_plan_uses_question_slug_when_question_is_only_source(self):
        plan = downloader.item_fetch_plan(
            {
                "question": {"title": "Two Sum", "titleSlug": "two-sum"},
                "article": None,
                "htmlArticle": None,
                "video": None,
                "webPage": None,
            }
        )

        self.assertIsNotNone(plan)
        assert plan is not None
        self.assertEqual(plan.kind, "question")
        self.assertEqual(plan.operation_name, "GetQuestion")
        self.assertEqual(plan.variable_name, "titleSlug")
        self.assertEqual(plan.variable_value, "two-sum")

    def test_summarize_question_payload_extracts_text_and_hints(self):
        payload = {
            "question": {
                "questionId": "1",
                "questionFrontendId": "1",
                "questionTitle": "Two Sum",
                "content": "<p>Find two numbers.</p>",
                "translatedContent": "",
                "hints": ["Use a hash map."],
                "solution": {
                    "title": "Solution",
                    "content": "<p>Track seen values.</p>",
                    "canSeeDetail": True,
                    "paidOnly": False,
                    "titleSlug": "two-sum-solution",
                    "hasVideoSolution": False,
                    "paidOnlyVideo": False,
                    "rating": {"average": 4.5},
                },
            }
        }

        summary = downloader.summarize_item_payload("question", payload)

        self.assertEqual(summary["title"], "Two Sum")
        self.assertIn("Find two numbers.", summary["textContent"])
        self.assertIn("Track seen values.", summary["textContent"])
        self.assertIn("Use a hash map.", summary["textContent"])


if __name__ == "__main__":
    unittest.main()
